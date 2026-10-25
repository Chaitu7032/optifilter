"""
OptiFilter / MorphoVision - Experiments & Ablations API Router
"""
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db.database import get_all_experiments
from app.experiments.runner import run_standard_ablation_matrix
from app.evaluation.dataset_adapters import get_all_adapters

router = APIRouter(prefix="/experiments", tags=["experiments"])


class AblationTriggerRequest(BaseModel):
    dataset_name: str = "DRIVE"
    split: str = "training"


@router.get("")
async def list_experiments():
    """Returns recorded ablation experiment runs and metrics comparisons."""
    return get_all_experiments()


@router.post("/run-ablations")
async def trigger_ablations(req: AblationTriggerRequest):
    """Executes the standard one-variable-at-a-time ablation experiment suite on an installed benchmark dataset."""
    adapters = get_all_adapters()
    adapter = adapters.get(req.dataset_name)
    if not adapter or not adapter.is_installed():
        raise HTTPException(
            status_code=400,
            detail=f"Dataset '{req.dataset_name}' is not installed in backend/data/datasets. Please install DRIVE or Drishti-GS to execute the ablation experiment matrix.",
        )

    try:
        runs = run_standard_ablation_matrix(
            dataset_name=req.dataset_name,
            split=req.split,
        )
        return {
            "success": True,
            "message": f"Successfully completed {len(runs)} ablation experiments.",
            "experiments": get_all_experiments(),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

