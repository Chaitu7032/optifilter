"""
OptiFilter / MorphoVision - CPU Performance Profiler
Precision timing with time.perf_counter() and psutil memory tracking.
Deterministic, reproducible, with zero GPU dependency.
"""
from typing import Dict, Any, List, Callable, Optional
import time
import os
import psutil
from app.config import SYSTEM_METADATA


class PipelineProfiler:
    """Instruments and records sub-stage timing breakdowns during DIP execution."""

    def __init__(self, include_memory: bool = True):
        self.include_memory = include_memory
        self.stages: Dict[str, float] = {}
        self.start_times: Dict[str, float] = {}
        self.total_start_time: float = 0.0
        self.total_time: float = 0.0
        self.process = psutil.Process(os.getpid()) if include_memory else None
        self.start_memory_bytes: int = 0
        self.peak_memory_bytes: int = 0

    def start(self):
        """Starts overall pipeline timer and records initial memory."""
        if self.process:
            self.start_memory_bytes = self.process.memory_info().rss
            self.peak_memory_bytes = self.start_memory_bytes
        self.total_start_time = time.perf_counter()

    def start_stage(self, stage_name: str):
        """Begins timing a sub-stage."""
        self.start_times[stage_name] = time.perf_counter()

    def end_stage(self, stage_name: str) -> float:
        """Ends timing for a sub-stage and records elapsed seconds."""
        now = time.perf_counter()
        elapsed = now - self.start_times.get(stage_name, now)
        self.stages[stage_name] = round(elapsed * 1000.0, 3)  # store in milliseconds
        if self.process:
            current_mem = self.process.memory_info().rss
            if current_mem > self.peak_memory_bytes:
                self.peak_memory_bytes = current_mem
        return elapsed

    def finish(self) -> Dict[str, Any]:
        """Finishes overall pipeline timer and compiles structured telemetry."""
        self.total_time = (time.perf_counter() - self.total_start_time) * 1000.0
        
        mem_delta_mb = 0.0
        peak_mem_mb = 0.0
        if self.process:
            current_mem = self.process.memory_info().rss
            if current_mem > self.peak_memory_bytes:
                self.peak_memory_bytes = current_mem
            mem_delta_mb = round((self.peak_memory_bytes - self.start_memory_bytes) / (1024 * 1024), 2)
            peak_mem_mb = round(self.peak_memory_bytes / (1024 * 1024), 2)

        return {
            "total_ms": round(self.total_time, 2),
            "stages_ms": self.stages,
            "memory_delta_mb": mem_delta_mb,
            "peak_memory_mb": peak_mem_mb,
            "under_two_seconds": self.total_time < 2000.0,
            "system_info": SYSTEM_METADATA,
        }


def benchmark_repeated_runs(
    run_func: Callable[[], Any],
    warmup_runs: int = 2,
    measured_runs: int = 5,
) -> Dict[str, Any]:
    """
    Executes warmup runs followed by measured runs to report rigorous latency stats.
    Calculates median, mean, standard deviation, and p95 latency in ms.
    """
    import numpy as np

    # Warmup runs to stabilize CPU cache & JIT/module loading
    for _ in range(warmup_runs):
        _ = run_func()

    timings_ms: List[float] = []
    for _ in range(measured_runs):
        t0 = time.perf_counter()
        _ = run_func()
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        timings_ms.append(elapsed_ms)

    arr = np.array(timings_ms)
    mean_lat = float(np.mean(arr))
    median_lat = float(np.median(arr))
    std_lat = float(np.std(arr))
    p95_lat = float(np.percentile(arr, 95))
    images_per_sec = float(1000.0 / mean_lat) if mean_lat > 0 else 0.0

    return {
        "num_runs": measured_runs,
        "mean_ms": round(mean_lat, 2),
        "median_ms": round(median_lat, 2),
        "std_ms": round(std_lat, 2),
        "p95_ms": round(p95_lat, 2),
        "images_per_second": round(images_per_sec, 2),
        "raw_runs_ms": [round(x, 2) for x in timings_ms],
        "system_info": SYSTEM_METADATA,
    }
