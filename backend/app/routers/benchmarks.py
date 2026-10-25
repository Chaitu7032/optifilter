"""
OptiFilter / MorphoVision - Benchmarks API Router
Endpoints for dataset discovery and benchmark execution.
"""
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel

from app.evaluation.dataset_adapters import get_all_adapters
from app.experiments.runner import execute_benchmark_run
from app.db.database import get_all_benchmarks, get_benchmark_by_id

router = APIRouter(prefix="/benchmarks", tags=["benchmarks"])


class BenchmarkRequest(BaseModel):
    dataset_name: str
    split: str = "dev"
    track: str = "vessels"  # "vessels" or "disc_cup"
    custom_params: Optional[Dict[str, Any]] = None
    run_name: Optional[str] = None


@router.get("/datasets")
async def list_datasets():
    """Lists supported datasets, their installation status, and image counts."""
    adapters = get_all_adapters()
    summary = []
    for name, adapter in adapters.items():
        installed = adapter.is_installed()
        items = adapter.get_images() if installed else []
        splits = list(set(it.get("split", "default") for it in items))
        summary.append({
            "name": name,
            "installed": installed,
            "total_images": len(items),
            "splits": splits,
            "items": [{"id": it["id"], "split": it.get("split")} for it in items[:15]],  # preview list
        })
    return summary


@router.post("")
async def run_benchmark(req: BenchmarkRequest):
    """Executes a benchmark run across the specified dataset and split."""
    try:
        run_record = execute_benchmark_run(
            dataset_name=req.dataset_name,
            split=req.split,
            track=req.track,
            custom_params=req.custom_params,
            run_name=req.run_name,
        )
        return run_record
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("")
async def list_benchmarks():
    """Returns history of all benchmark runs."""
    return get_all_benchmarks()


@router.get("/{run_id}")
async def get_benchmark(run_id: str):
    """Returns details and per-image evaluations for a specific benchmark run."""
    run = get_benchmark_by_id(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Benchmark run not found")
    return run
