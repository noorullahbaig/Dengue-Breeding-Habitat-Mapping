from __future__ import annotations

import json
import traceback
import uuid
from io import BytesIO
from datetime import datetime
from pathlib import Path
from threading import Thread, Lock
from time import time

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from batch_eval import run_batch_eval
from core import YoloRunner, prediction_to_dict, render_overlay, render_side_by_side


BASE_DIR = Path(__file__).resolve().parent
OUTPUTS_DIR = BASE_DIR / "outputs"
FRONTEND_DIR = BASE_DIR / "frontend"
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

OLD_MODEL_PATH = Path("/Users/noorullah/Desktop/FYP CODEX/ml_workspace/models/current_yolo/best.pt")
NEW_MODEL_PATH = Path(
    "/Users/noorullah/Desktop/FYP CODEX/ml_workspace/models/experiments/yolov8n_retained_three_class_v1/weights/best.pt"
)

app = FastAPI(title="Model Compare App", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/outputs", StaticFiles(directory=OUTPUTS_DIR), name="outputs")

old_runner: YoloRunner | None = None
new_runner: YoloRunner | None = None
last_old_runner_error: str | None = None
last_new_runner_error: str | None = None
jobs_lock = Lock()
jobs: dict[str, dict] = {}
last_old_load_attempt_at: str | None = None
last_new_load_attempt_at: str | None = None
last_successful_inference_at: str | None = None


def get_old_runner() -> YoloRunner:
    global old_runner
    global last_old_runner_error
    global last_old_load_attempt_at
    last_old_load_attempt_at = datetime.utcnow().isoformat()
    if old_runner is None:
        try:
            old_runner = YoloRunner(OLD_MODEL_PATH)
            last_old_runner_error = None
        except Exception as exc:
            last_old_runner_error = str(exc)
            raise
    return old_runner


def get_new_runner() -> YoloRunner:
    global new_runner
    global last_new_runner_error
    global last_new_load_attempt_at
    last_new_load_attempt_at = datetime.utcnow().isoformat()
    if new_runner is None:
        try:
            new_runner = YoloRunner(NEW_MODEL_PATH)
            last_new_runner_error = None
        except Exception as exc:
            last_new_runner_error = str(exc)
            raise
    return new_runner


class BatchRequest(BaseModel):
    imagesDir: str
    labelsDir: str


def api_error(code: str, message: str, status: int, details: dict | None = None) -> HTTPException:
    trace_id = uuid.uuid4().hex[:12]
    payload = {"code": code, "message": message, "traceId": trace_id}
    if details:
        payload["details"] = details
    return HTTPException(status_code=status, detail=payload)


def _is_writable(path: Path) -> bool:
    try:
        path.mkdir(parents=True, exist_ok=True)
        probe = path / ".write_probe"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink(missing_ok=True)
        return True
    except Exception:
        return False


def _load_progress_from_disk(run_dir: Path) -> dict | None:
    progress_path = _job_progress_path(run_dir)
    if not progress_path.exists():
        return None
    try:
        return json.loads(progress_path.read_text(encoding="utf-8"))
    except Exception:
        return None


@app.get("/")
def home() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "oldModelPath": str(OLD_MODEL_PATH),
        "newModelPath": str(NEW_MODEL_PATH),
        "outputsDir": str(OUTPUTS_DIR),
    }


@app.get("/health/details")
def health_details() -> dict:
    return {
        "ok": True,
        "models": {
            "old": {
                "path": str(OLD_MODEL_PATH),
                "exists": OLD_MODEL_PATH.exists(),
                "loaded": old_runner is not None,
                "lastError": last_old_runner_error,
                "lastLoadAttemptAt": last_old_load_attempt_at,
            },
            "new": {
                "path": str(NEW_MODEL_PATH),
                "exists": NEW_MODEL_PATH.exists(),
                "loaded": new_runner is not None,
                "lastError": last_new_runner_error,
                "lastLoadAttemptAt": last_new_load_attempt_at,
            },
        },
        "lastSuccessfulInferenceAt": last_successful_inference_at,
        "outputsWritable": _is_writable(OUTPUTS_DIR),
    }


@app.post("/compare")
async def compare(image: UploadFile = File(...)) -> dict:
    if not image.filename:
        raise api_error("INVALID_IMAGE", "Missing image filename.", 400)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    run_dir = OUTPUTS_DIR / "single_runs" / ts
    run_dir.mkdir(parents=True, exist_ok=True)

    try:
        from PIL import Image

        raw_bytes = await image.read()
        with Image.open(BytesIO(raw_bytes)) as decoded:
            decoded_rgb = decoded.convert("RGB")
            source_path = run_dir / "source.jpg"
            decoded_rgb.save(source_path, format="JPEG", quality=95)
    except Exception as exc:
        raise api_error("INVALID_IMAGE", "Uploaded file is not a readable image.", 400, {"cause": str(exc)})

    try:
        old_pred = get_old_runner().predict(source_path)
        new_pred = get_new_runner().predict(source_path)
        global last_successful_inference_at
        last_successful_inference_at = datetime.utcnow().isoformat()
    except HTTPException:
        raise
    except Exception:
        trace_id = uuid.uuid4().hex[:12]
        (run_dir / "error_trace.txt").write_text(traceback.format_exc(), encoding="utf-8")
        raise HTTPException(
            status_code=500,
            detail={
                "code": "INFERENCE_FAILED",
                "message": "Model inference failed. Check /health/details.",
                "traceId": trace_id,
            },
        )

    old_img = run_dir / "old_overlay.jpg"
    new_img = run_dir / "new_overlay.jpg"
    side_by_side = run_dir / "side_by_side.jpg"

    render_overlay(source_path, old_pred.detections, old_img)
    render_overlay(source_path, new_pred.detections, new_img)
    render_side_by_side(old_img, new_img, side_by_side)

    payload = {
        "sessionId": ts,
        "upload": {
            "originalFilename": image.filename,
            "contentType": image.content_type,
            "storedAs": "source.jpg",
        },
        "old": prediction_to_dict(old_pred),
        "new": prediction_to_dict(new_pred),
        "images": {
            "source": f"/outputs/single_runs/{ts}/source.jpg",
            "oldOverlay": f"/outputs/single_runs/{ts}/old_overlay.jpg",
            "newOverlay": f"/outputs/single_runs/{ts}/new_overlay.jpg",
            "sideBySide": f"/outputs/single_runs/{ts}/side_by_side.jpg",
        },
    }

    (run_dir / "compare_result.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return payload


def _job_progress_path(run_dir: Path) -> Path:
    return run_dir / "progress.json"


def _write_progress(run_dir: Path, payload: dict) -> None:
    _job_progress_path(run_dir).write_text(json.dumps(payload, indent=2), encoding="utf-8")


@app.get("/health/self-test")
def health_self_test() -> dict:
    from PIL import Image

    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
    test_dir = OUTPUTS_DIR / "self_test"
    test_dir.mkdir(parents=True, exist_ok=True)
    test_file = test_dir / f"probe_{ts}.jpg"
    img = Image.new("RGB", (16, 16), color=(120, 160, 200))
    img.save(test_file, format="JPEG")
    exists = test_file.exists()
    if exists:
        test_file.unlink(missing_ok=True)
    return {"ok": exists, "outputsWritable": _is_writable(OUTPUTS_DIR)}


@app.post("/batch-jobs")
def create_batch_job(req: BatchRequest) -> dict:
    images_dir = Path(req.imagesDir).expanduser().resolve()
    labels_dir = Path(req.labelsDir).expanduser().resolve()
    if not images_dir.exists():
        raise api_error("INVALID_PATH", f"imagesDir not found: {images_dir}", 400)
    if not labels_dir.exists():
        raise api_error("INVALID_PATH", f"labelsDir not found: {labels_dir}", 400)

    job_id = datetime.now().strftime("%Y%m%d_%H%M%S") + "_" + uuid.uuid4().hex[:6]
    run_dir = OUTPUTS_DIR / "batch_runs" / job_id
    run_dir.mkdir(parents=True, exist_ok=True)
    state = {
        "jobId": job_id,
        "status": "queued",
        "processed": 0,
        "total": 0,
        "percent": 0.0,
        "currentFile": None,
        "startedAt": datetime.utcnow().isoformat(),
        "updatedAt": datetime.utcnow().isoformat(),
        "elapsedSeconds": 0.0,
        "lastHeartbeatAt": datetime.utcnow().isoformat(),
        "imagesPerMinute": 0.0,
        "runDir": str(run_dir),
        "imagesDir": str(images_dir),
        "labelsDir": str(labels_dir),
        "cancelRequested": False,
        "error": None,
        "result": None,
        "previewItems": [],
    }
    with jobs_lock:
        jobs[job_id] = state
    _write_progress(run_dir, state)

    def worker() -> None:
        start_ts = time()
        try:
            with jobs_lock:
                jobs[job_id]["status"] = "running"
            _write_progress(run_dir, jobs[job_id])

            def progress_cb(update: dict) -> None:
                with jobs_lock:
                    current = jobs[job_id]
                    current["processed"] = update["processed"]
                    current["total"] = update["total"]
                    current["percent"] = update["percent"]
                    current["currentFile"] = update["currentFile"]
                    current["updatedAt"] = datetime.utcnow().isoformat()
                    current["elapsedSeconds"] = round(time() - start_ts, 2)
                    current["lastHeartbeatAt"] = datetime.utcnow().isoformat()
                    elapsed_minutes = max(current["elapsedSeconds"] / 60.0, 1e-6)
                    current["imagesPerMinute"] = round(current["processed"] / elapsed_minutes, 2)
                    current["previewItems"].append(update["previewItem"])
                _write_progress(run_dir, jobs[job_id])

            def cancel_check() -> bool:
                with jobs_lock:
                    return bool(jobs[job_id]["cancelRequested"])

            result = run_batch_eval(
                old_model_path=OLD_MODEL_PATH,
                new_model_path=NEW_MODEL_PATH,
                images_dir=images_dir,
                labels_dir=labels_dir,
                run_dir=run_dir,
                progress_cb=progress_cb,
                cancel_check=cancel_check,
            )
            with jobs_lock:
                jobs[job_id]["status"] = "completed"
                jobs[job_id]["result"] = result
                jobs[job_id]["updatedAt"] = datetime.utcnow().isoformat()
                jobs[job_id]["elapsedSeconds"] = round(time() - start_ts, 2)
                jobs[job_id]["lastHeartbeatAt"] = datetime.utcnow().isoformat()
            _write_progress(run_dir, jobs[job_id])
        except Exception:
            with jobs_lock:
                jobs[job_id]["status"] = "failed"
                jobs[job_id]["error"] = traceback.format_exc()
                jobs[job_id]["updatedAt"] = datetime.utcnow().isoformat()
                jobs[job_id]["elapsedSeconds"] = round(time() - start_ts, 2)
                jobs[job_id]["lastHeartbeatAt"] = datetime.utcnow().isoformat()
            (run_dir / "error_trace.txt").write_text(traceback.format_exc(), encoding="utf-8")
            _write_progress(run_dir, jobs[job_id])

    Thread(target=worker, daemon=True).start()
    return {"jobId": job_id}


@app.get("/batch-jobs/{job_id}")
def get_batch_job(job_id: str) -> dict:
    with jobs_lock:
        state = jobs.get(job_id)
    if not state:
        raise api_error("JOB_NOT_FOUND", f"Unknown job id: {job_id}", 404)
    disk_state = _load_progress_from_disk(Path(state["runDir"]))
    if disk_state:
        state = disk_state
    return {
        "jobId": state["jobId"],
        "status": state["status"],
        "processed": state["processed"],
        "total": state["total"],
        "percent": state["percent"],
        "currentFile": state["currentFile"],
        "startedAt": state["startedAt"],
        "updatedAt": state["updatedAt"],
        "elapsedSeconds": state["elapsedSeconds"],
        "lastHeartbeatAt": state.get("lastHeartbeatAt"),
        "imagesPerMinute": state.get("imagesPerMinute", 0.0),
        "error": state["error"],
        "runDir": state["runDir"],
    }


@app.get("/batch-jobs/{job_id}/preview")
def get_batch_job_preview(job_id: str) -> dict:
    with jobs_lock:
        state = jobs.get(job_id)
    if not state:
        raise api_error("JOB_NOT_FOUND", f"Unknown job id: {job_id}", 404)
    disk_state = _load_progress_from_disk(Path(state["runDir"]))
    if disk_state:
        state = disk_state
    cache_buster = str(int(time()))
    preview_items = []
    for item in state["previewItems"]:
        preview_items.append(
            {
                **item,
                "overlays": {
                    "old": "/outputs/" + str(Path(item["overlays"]["old"]).relative_to(OUTPUTS_DIR)) + f"?v={cache_buster}",
                    "new": "/outputs/" + str(Path(item["overlays"]["new"]).relative_to(OUTPUTS_DIR)) + f"?v={cache_buster}",
                    "pair": "/outputs/" + str(Path(item["overlays"]["pair"]).relative_to(OUTPUTS_DIR)) + f"?v={cache_buster}",
                },
            }
        )
    return {"jobId": job_id, "items": preview_items}


@app.get("/batch-jobs/{job_id}/result")
def get_batch_job_result(job_id: str) -> dict:
    with jobs_lock:
        state = jobs.get(job_id)
    if not state:
        raise api_error("JOB_NOT_FOUND", f"Unknown job id: {job_id}", 404)
    if state["status"] != "completed":
        raise api_error("JOB_NOT_READY", "Batch job not completed yet.", 409)
    run_dir = Path(state["runDir"])
    result = dict(state["result"])
    result["artifacts"] = {
        "confusionOld": "/outputs/" + str((run_dir / "confusion_old.png").relative_to(OUTPUTS_DIR)),
        "confusionNew": "/outputs/" + str((run_dir / "confusion_new.png").relative_to(OUTPUTS_DIR)),
        "classMetricsOld": "/outputs/" + str((run_dir / "class_metrics_old.png").relative_to(OUTPUTS_DIR)),
        "classMetricsNew": "/outputs/" + str((run_dir / "class_metrics_new.png").relative_to(OUTPUTS_DIR)),
        "latencyComparison": "/outputs/" + str((run_dir / "latency_comparison.png").relative_to(OUTPUTS_DIR)),
        "csv": "/outputs/" + str((run_dir / "per_image_results.csv").relative_to(OUTPUTS_DIR)),
        "metricsJson": "/outputs/" + str((run_dir / "metrics_summary.json").relative_to(OUTPUTS_DIR)),
    }
    return result


@app.post("/batch-jobs/{job_id}/cancel")
def cancel_batch_job(job_id: str) -> dict:
    with jobs_lock:
        state = jobs.get(job_id)
        if not state:
            raise api_error("JOB_NOT_FOUND", f"Unknown job id: {job_id}", 404)
        if state["status"] in {"completed", "failed"}:
            return {"jobId": job_id, "status": state["status"]}
        state["cancelRequested"] = True
        state["status"] = "cancel_requested"
        state["updatedAt"] = datetime.utcnow().isoformat()
    _write_progress(Path(state["runDir"]), state)
    return {"jobId": job_id, "status": "cancel_requested"}
