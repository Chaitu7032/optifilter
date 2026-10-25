"""
OptiFilter / MorphoVision - Scientific Workstation Backend Entrypoint
FastAPI REST API with deterministic classical DIP algorithms.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import SYSTEM_METADATA
from app.db.database import init_db
from app.routers import analysis, benchmarks, experiments, exports


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database schema
    init_db()
    yield


app = FastAPI(
    title="OptiFilter (MorphoVision) Scientific API",
    version="1.0.0",
    description="Lightweight Classical Digital Image Processing for Retinal Vessel and Optic Disc/Cup Segmentation",
    lifespan=lifespan,
)

# Enable CORS for local Vite development frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(analysis.router, prefix="/api/v1")
app.include_router(benchmarks.router, prefix="/api/v1")
app.include_router(experiments.router, prefix="/api/v1")
app.include_router(exports.router, prefix="/api/v1")


@app.get("/api/v1/health")
async def health_check():
    """Health status and CPU runtime environment metadata."""
    return {
        "status": "healthy",
        "service": "OptiFilter Scientific DIP Workstation",
        "version": "1.0.0",
        "system": SYSTEM_METADATA,
        "ai_free_guarantee": True,
        "classical_dip_only": True,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
