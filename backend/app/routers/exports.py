"""
OptiFilter / MorphoVision - Exports API Router
Provides real CSV and JSON scientific data export for reproducibility.
"""
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.config import ARTIFACTS_DIR
from app.db.database import get_benchmark_by_id

router = APIRouter(prefix="/exports", tags=["exports"])


@router.get("/csv/{run_id}")
async def export_benchmark_csv(run_id: str):
    """Downloads the per-image benchmark CSV containing real computed metrics."""
    csv_file = ARTIFACTS_DIR / f"{run_id}.csv"
    if not csv_file.exists():
        # Check if benchmark exists in DB and regenerate CSV
        run = get_benchmark_by_id(run_id)
        if not run:
            raise HTTPException(status_code=404, detail="Benchmark run artifact not found")
        
        import pandas as pd
        per_img = run.get("per_image_results", [])
        if not per_img:
            raise HTTPException(status_code=404, detail="No per-image evaluations to export")
        
        flat_rows = []
        for it in per_img:
            r = {"item_id": it["item_id"], "runtime_ms": it["runtime_ms"]}
            if "metrics" in it and it["metrics"]:
                r.update(it["metrics"])
            if "vcdr" in it:
                r["vcdr"] = it["vcdr"]
            if "cdr_absolute_error" in it:
                r["cdr_error"] = it["cdr_absolute_error"]
            flat_rows.append(r)
        
        df = pd.DataFrame(flat_rows)
        df.to_csv(csv_file, index=False)

    return FileResponse(
        path=str(csv_file),
        filename=f"optifilter_{run_id}.csv",
        media_type="text/csv",
    )


@router.get("/json/{run_id}")
async def export_benchmark_json(run_id: str):
    """Downloads raw JSON experiment and benchmark metadata."""
    run = get_benchmark_by_id(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Benchmark run not found")
    return run
