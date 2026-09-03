"""Optimisation job submission, status and results."""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...database import get_db
from ...models import Route, Vessel
from ...schemas import OptimizationRequest
from ...tasks.optimization_task import registry

router = APIRouter(prefix="/optimize", tags=["optimization"])


@router.post("", status_code=202)
async def start_optimization(payload: OptimizationRequest, db: Session = Depends(get_db)):
    """Submit an optimisation run. Returns immediately with a task id."""
    vessels = db.query(Vessel).filter(Vessel.id.in_(payload.vessel_ids)).all()
    if len(vessels) != len(payload.vessel_ids):
        missing = set(payload.vessel_ids) - {v.id for v in vessels}
        raise HTTPException(404, f"Vessels not found: {sorted(missing)}")

    routes = db.query(Route).filter(Route.id.in_(payload.route_ids)).all()
    if len(routes) != len(payload.route_ids):
        missing = set(payload.route_ids) - {r.id for r in routes}
        raise HTTPException(404, f"Routes not found: {sorted(missing)}")

    vessel_data = [v.to_dict() for v in vessels]
    route_data = [r.to_dict() for r in routes]

    # Every route must have at least one vessel able to serve it, or the QUBO's
    # route-coverage constraint is unsatisfiable and the anneal wastes its time.
    for route in route_data:
        capable = [v for v in vessel_data if v["dwt"] >= route["cargo_demand_t"]]
        if not capable:
            raise HTTPException(422,
                f"No selected vessel can carry {route['cargo_demand_t']:,.0f} t "
                f"on route '{route['name']}'. Largest selected is "
                f"{max(v['dwt'] for v in vessel_data):,.0f} t DWT.")

    if payload.fuel_ids:
        for vessel in vessel_data:
            if not set(payload.fuel_ids) & set(vessel["compatible_fuels"]):
                raise HTTPException(422,
                    f"{vessel['name']} cannot burn any of {payload.fuel_ids}. "
                    f"Compatible: {vessel['compatible_fuels']}")

    request = payload.model_dump()
    request["weights"] = payload.weights.normalized()

    task_id = registry.create(request)
    asyncio.create_task(registry.run(task_id, vessel_data, route_data, request))

    return {
        "task_id": task_id,
        "status": "pending",
        "message": "Optimisation queued",
        "websocket_url": f"/ws/optimization/{task_id}",
        "poll_url": f"/api/v1/optimize/{task_id}",
    }


@router.get("/tasks")
def list_tasks(limit: int = 25):
    return registry.list_tasks(limit)


@router.get("/{task_id}")
def get_optimization(task_id: str, include_result: bool = True):
    """Poll a run's status, and its full result once complete."""
    task = registry.get(task_id)
    if task is None:
        raise HTTPException(404, f"Task '{task_id}' not found")

    payload = {
        "task_id": task["task_id"], "status": task["status"],
        "progress": task["progress"], "phase": task["phase"],
        "message": task["message"], "created_at": task["created_at"],
        "completed_at": task["completed_at"],
        "runtime_seconds": task["runtime_seconds"], "error": task["error"],
    }
    if include_result and task["status"] == "completed":
        payload["result"] = task["result"]
    return payload


@router.get("/{task_id}/events")
def get_events(task_id: str, since: int = 0):
    """Progress events, for clients that poll rather than hold a WebSocket."""
    task = registry.get(task_id)
    if task is None:
        raise HTTPException(404, f"Task '{task_id}' not found")
    events = task["events"][since:]
    return {"task_id": task_id, "status": task["status"],
            "events": events, "next_index": since + len(events)}


@router.get("/{task_id}/solution/{solution_id}")
def get_solution(task_id: str, solution_id: str):
    """One Pareto solution in full, for the detail panel."""
    task = registry.get(task_id)
    if task is None:
        raise HTTPException(404, f"Task '{task_id}' not found")
    if task["status"] != "completed":
        raise HTTPException(409, f"Task is '{task['status']}', not completed")

    for solution in task["result"]["pareto_solutions"]:
        if solution["solution_id"] == solution_id:
            return solution
    raise HTTPException(404, f"Solution '{solution_id}' not found")
