"""WebSocket endpoint streaming live optimisation progress."""

from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..tasks.optimization_task import registry

router = APIRouter()


@router.websocket("/ws/optimization/{task_id}")
async def optimization_progress(websocket: WebSocket, task_id: str):
    """Stream annealing and swarm telemetry for one run.

    Replays the backlog first so a client that connects mid-run still renders a
    complete convergence curve, then follows live events to completion.
    """
    await websocket.accept()

    task = registry.get(task_id)
    if task is None:
        await websocket.send_json({"type": "error", "message": f"Task '{task_id}' not found"})
        await websocket.close()
        return

    queue = await registry.subscribe(task_id)
    try:
        await websocket.send_json({
            "type": "snapshot",
            "task_id": task_id,
            "status": task["status"],
            "progress": task["progress"],
            "phase": task["phase"],
            "message": task["message"],
            "events": task["events"][-120:],
        })

        # A task that finished before the client connected still needs its result.
        if task["status"] in ("completed", "failed"):
            await websocket.send_json({
                "type": "final", "task_id": task_id, "status": task["status"],
                "error": task.get("error"),
                "result": task.get("result") if task["status"] == "completed" else None,
            })
            await websocket.close()
            return

        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=30.0)
            except asyncio.TimeoutError:
                # Keepalive: proxies drop idle sockets, and a long anneal can be
                # quiet between trace points.
                await websocket.send_json({"type": "ping"})
                current = registry.get(task_id)
                if current and current["status"] in ("completed", "failed"):
                    break
                continue

            await websocket.send_json({"type": "progress", **event})

            if event.get("phase") in ("complete", "error"):
                # The optimiser emits its "complete" phase from inside the worker
                # thread, a moment before the registry flips status and stores the
                # result. Breaking immediately would send a final frame with a
                # null result, so wait briefly for the task to actually settle.
                for _ in range(100):
                    current = registry.get(task_id)
                    if current and current["status"] in ("completed", "failed"):
                        break
                    await asyncio.sleep(0.05)
                break

        final = registry.get(task_id)
        if final is not None:
            await websocket.send_json({
                "type": "final", "task_id": task_id, "status": final["status"],
                "error": final.get("error"),
                "result": final.get("result") if final["status"] == "completed" else None,
            })
    except WebSocketDisconnect:
        pass
    except Exception as exc:  # noqa: BLE001
        try:
            await websocket.send_json({"type": "error", "message": str(exc)})
        except Exception:
            pass
    finally:
        await registry.unsubscribe(task_id, queue)
        try:
            await websocket.close()
        except Exception:
            pass
