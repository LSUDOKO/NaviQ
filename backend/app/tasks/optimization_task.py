"""In-process async task runner for optimisation jobs.

Celery plus Redis would be the production choice. For a self-contained demo
this runs the optimiser in a thread pool and publishes progress to any
subscribed WebSocket, which gives the same API surface -- submit, poll, stream --
with nothing to install.

The optimiser is CPU-bound NumPy, so a thread pool genuinely parallelises it:
NumPy releases the GIL during array operations.
"""

from __future__ import annotations

import asyncio
import json
import traceback
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any

_executor = ThreadPoolExecutor(max_workers=3, thread_name_prefix="naviq-opt")


class TaskRegistry:
    """Tracks running and completed optimisation jobs, with progress fan-out."""

    def __init__(self) -> None:
        self._tasks: dict[str, dict[str, Any]] = {}
        self._subscribers: dict[str, list[asyncio.Queue]] = {}
        self._lock = asyncio.Lock()

    # -- lifecycle ---------------------------------------------------------
    def create(self, payload: dict) -> str:
        task_id = str(uuid.uuid4())
        self._tasks[task_id] = {
            "task_id": task_id,
            "status": "pending",
            "progress": 0.0,
            "phase": "pending",
            "message": "Queued",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "completed_at": None,
            "runtime_seconds": None,
            "request": payload,
            "result": None,
            "error": None,
            "events": [],
        }
        return task_id

    def get(self, task_id: str) -> dict | None:
        return self._tasks.get(task_id)

    def list_tasks(self, limit: int = 25) -> list[dict]:
        tasks = sorted(self._tasks.values(), key=lambda t: t["created_at"], reverse=True)
        return [self._summary(t) for t in tasks[:limit]]

    @staticmethod
    def _summary(task: dict) -> dict:
        return {k: v for k, v in task.items() if k not in ("result", "events", "request")}

    # -- progress fan-out --------------------------------------------------
    async def subscribe(self, task_id: str) -> asyncio.Queue:
        async with self._lock:
            queue: asyncio.Queue = asyncio.Queue(maxsize=500)
            self._subscribers.setdefault(task_id, []).append(queue)
            return queue

    async def unsubscribe(self, task_id: str, queue: asyncio.Queue) -> None:
        async with self._lock:
            if task_id in self._subscribers:
                try:
                    self._subscribers[task_id].remove(queue)
                except ValueError:
                    pass
                if not self._subscribers[task_id]:
                    del self._subscribers[task_id]

    def _publish(self, task_id: str, event: dict, loop: asyncio.AbstractEventLoop) -> None:
        """Push an event to every subscriber. Called from the worker thread."""
        task = self._tasks.get(task_id)
        if task is not None:
            task["progress"] = event.get("progress", task["progress"])
            task["phase"] = event.get("phase", task["phase"])
            task["message"] = event.get("message", task["message"])
            # Keep a bounded backlog so a late subscriber still sees the shape
            # of the run rather than an empty stream.
            task["events"].append(event)
            if len(task["events"]) > 400:
                task["events"] = task["events"][-400:]

        for queue in list(self._subscribers.get(task_id, [])):
            try:
                loop.call_soon_threadsafe(queue.put_nowait, event)
            except (asyncio.QueueFull, RuntimeError):
                # A slow or disconnected consumer must never stall the optimiser.
                pass

    # -- execution ---------------------------------------------------------
    async def run(self, task_id: str, vessels: list[dict], routes: list[dict],
                  request: dict) -> None:
        """Execute the optimisation off the event loop, streaming progress."""
        task = self._tasks[task_id]
        task["status"] = "running"
        task["phase"] = "setup"
        task["message"] = "Starting optimisation"

        loop = asyncio.get_running_loop()
        started = loop.time()

        def progress(event: dict) -> None:
            self._publish(task_id, {**event, "task_id": task_id}, loop)

        def work() -> dict:
            from ..core.optimization.hybrid_optimizer import HybridOptimizer

            optimizer = HybridOptimizer(
                vessels=vessels, routes=routes,
                year=request.get("year", 2026), month=request.get("month", 7),
                uncertainty_lambda=request.get("uncertainty_lambda", 1.0),
                qubo_steps=request.get("qubo_steps", 180),
                qubo_replicas=request.get("qubo_replicas", 8),
                qpso_particles=request.get("qpso_particles", 24),
                qpso_iterations=request.get("qpso_iterations", 70),
                seed=42,
            )
            return optimizer.run(
                fuels=request.get("fuel_ids"),
                n_solutions=request.get("n_solutions", 12),
                progress=progress,
            )

        try:
            result = await loop.run_in_executor(_executor, work)
            task["status"] = "completed"
            task["result"] = result
            task["progress"] = 1.0
            task["phase"] = "complete"
            task["message"] = f"{result.get('n_pareto_optimal', 0)} Pareto-optimal plans found"
            task["runtime_seconds"] = round(loop.time() - started, 3)
            task["completed_at"] = datetime.now(timezone.utc).isoformat()
            self._publish(task_id, {
                "task_id": task_id, "phase": "complete", "progress": 1.0,
                "status": "completed", "message": task["message"],
                "n_pareto_optimal": result.get("n_pareto_optimal", 0),
            }, loop)
            self._persist(task_id, task, request, result)
        except Exception as exc:  # noqa: BLE001 - surfaced to the client
            task["status"] = "failed"
            task["error"] = f"{type(exc).__name__}: {exc}"
            task["message"] = "Optimisation failed"
            task["completed_at"] = datetime.now(timezone.utc).isoformat()
            task["traceback"] = traceback.format_exc()
            self._publish(task_id, {
                "task_id": task_id, "phase": "error", "status": "failed",
                "error": task["error"], "message": task["message"],
            }, loop)

    @staticmethod
    def _persist(task_id: str, task: dict, request: dict, result: dict) -> None:
        """Store the run so the dashboard can show history across restarts."""
        try:
            from ..database import SessionLocal
            from ..models import OptimizationResult

            summary = result.get("front_summary", {})
            with SessionLocal() as db:
                db.add(OptimizationResult(
                    id=task_id, status="completed",
                    completed_at=datetime.now(timezone.utc),
                    vessel_ids=json.dumps(request.get("vessel_ids", [])),
                    route_ids=json.dumps(request.get("route_ids", [])),
                    weights=json.dumps(request.get("weights", {})),
                    n_solutions=result.get("n_evaluated", 0),
                    n_pareto=result.get("n_pareto_optimal", 0),
                    runtime_seconds=result.get("runtime_seconds", 0.0),
                    best_cost_usd=summary.get("best_cost_usd") or 0.0,
                    best_ghg_t=summary.get("best_ghg_t") or 0.0,
                    result_json=json.dumps(result, default=str),
                ))
                db.commit()
        except Exception:
            # History is a convenience; never fail a completed run over it.
            pass


registry = TaskRegistry()
