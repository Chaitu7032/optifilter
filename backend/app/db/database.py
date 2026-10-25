"""
OptiFilter / MorphoVision - SQLite Database Engine
Lightweight, zero-overhead embedded persistence for benchmark runs and ablation experiments.
"""
import sqlite3
import json
from typing import Dict, Any, List, Optional
from pathlib import Path
from app.config import DB_PATH


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Benchmarks Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS benchmarks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        dataset TEXT NOT NULL,
        split TEXT NOT NULL,
        track TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        num_images INTEGER DEFAULT 0,
        mean_dice REAL,
        mean_iou REAL,
        mean_sensitivity REAL,
        mean_specificity REAL,
        mean_precision REAL,
        mean_cdr_error REAL,
        mean_runtime_ms REAL,
        median_runtime_ms REAL,
        parameters_json TEXT,
        per_image_results_json TEXT,
        telemetry_json TEXT
    );
    """)

    # Ablation Experiments Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS experiments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        track TEXT NOT NULL,
        variant_name TEXT NOT NULL,
        description TEXT,
        dataset TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        parameters_json TEXT,
        summary_metrics_json TEXT,
        runtime_ms REAL
    );
    """)

    conn.commit()
    conn.close()


def save_benchmark_run(run_data: Dict[str, Any]):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO benchmarks (
            id, name, dataset, split, track, status, created_at,
            num_images, mean_dice, mean_iou, mean_sensitivity, mean_specificity,
            mean_precision, mean_cdr_error, mean_runtime_ms, median_runtime_ms,
            parameters_json, per_image_results_json, telemetry_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        run_data["id"],
        run_data["name"],
        run_data["dataset"],
        run_data["split"],
        run_data["track"],
        run_data["status"],
        run_data["created_at"],
        run_data.get("num_images", 0),
        run_data.get("mean_dice"),
        run_data.get("mean_iou"),
        run_data.get("mean_sensitivity"),
        run_data.get("mean_specificity"),
        run_data.get("mean_precision"),
        run_data.get("mean_cdr_error"),
        run_data.get("mean_runtime_ms"),
        run_data.get("median_runtime_ms"),
        json.dumps(run_data.get("parameters", {})),
        json.dumps(run_data.get("per_image_results", [])),
        json.dumps(run_data.get("telemetry", {})),
    ))
    conn.commit()
    conn.close()


def get_all_benchmarks() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM benchmarks ORDER BY created_at DESC")
    rows = cursor.fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d["parameters"] = json.loads(d["parameters_json"]) if d["parameters_json"] else {}
        d["per_image_results"] = json.loads(d["per_image_results_json"]) if d["per_image_results_json"] else []
        d["telemetry"] = json.loads(d["telemetry_json"]) if d["telemetry_json"] else {}
        result.append(d)
    conn.close()
    return result


def get_benchmark_by_id(benchmark_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM benchmarks WHERE id = ?", (benchmark_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    d["parameters"] = json.loads(d["parameters_json"]) if d["parameters_json"] else {}
    d["per_image_results"] = json.loads(d["per_image_results_json"]) if d["per_image_results_json"] else []
    d["telemetry"] = json.loads(d["telemetry_json"]) if d["telemetry_json"] else {}
    return d


def save_experiment_run(exp_data: Dict[str, Any]):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO experiments (
            id, name, track, variant_name, description, dataset,
            status, created_at, parameters_json, summary_metrics_json, runtime_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        exp_data["id"],
        exp_data["name"],
        exp_data["track"],
        exp_data["variant_name"],
        exp_data.get("description", ""),
        exp_data["dataset"],
        exp_data["status"],
        exp_data["created_at"],
        json.dumps(exp_data.get("parameters", {})),
        json.dumps(exp_data.get("summary_metrics", {})),
        exp_data.get("runtime_ms"),
    ))
    conn.commit()
    conn.close()


def get_all_experiments() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM experiments ORDER BY created_at DESC")
    rows = cursor.fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d["parameters"] = json.loads(d["parameters_json"]) if d["parameters_json"] else {}
        d["summary_metrics"] = json.loads(d["summary_metrics_json"]) if d["summary_metrics_json"] else {}
        result.append(d)
    conn.close()
    return result
