from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parents[1]
for env_file in (BASE_DIR / ".env.local", BASE_DIR / ".env"):
    load_dotenv(env_file, override=False)


@dataclass(frozen=True)
class Settings:
    database_url: str
    model_path: Path
    upload_root: Path
    cors_origins: list[str]
    app_env: str = "development"
    idengue_hotspot_endpoint: str = "https://mygis.mysa.gov.my/erica1/rest/services/iDengue/WM_idengue/MapServer/0/query"
    max_upload_bytes: int = 10 * 1024 * 1024
    storage_backend: str = "local"
    s3_bucket: str | None = None
    s3_region: str = "ap-southeast-1"
    s3_presigned_url_expires_seconds: int = 3600
    cleanup_local_after_s3_upload: bool = False
    cognito_region: str | None = None
    cognito_user_pool_id: str | None = None
    cognito_app_client_id: str | None = None


def _resolve_path(value: str) -> Path:
    path = Path(value).expanduser()
    if not path.is_absolute():
        return (BASE_DIR / path).resolve()
    return path.resolve()


def get_settings() -> Settings:
    cors_origins = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173",
        ).split(",")
        if origin.strip()
    ]

    return Settings(
        database_url=os.getenv(
            "DATABASE_URL",
            "postgresql+psycopg://noorullah@localhost:5432/codex_fyp",
        ),
        model_path=_resolve_path(
            os.getenv(
                "MODEL_PATH",
                "./models/denguewatch_yolov8s_best.pt",
            )
        ),
        upload_root=_resolve_path(os.getenv("UPLOAD_ROOT", "./uploads")),
        cors_origins=cors_origins,
        app_env=os.getenv("APP_ENV", "development").strip().lower(),
        idengue_hotspot_endpoint=os.getenv(
            "IDENGUE_HOTSPOT_ENDPOINT",
            "https://mygis.mysa.gov.my/erica1/rest/services/iDengue/WM_idengue/MapServer/0/query",
        ),
        storage_backend=os.getenv("STORAGE_BACKEND", "local"),
        s3_bucket=os.getenv("S3_BUCKET"),
        s3_region=os.getenv("S3_REGION", "ap-southeast-1"),
        s3_presigned_url_expires_seconds=int(os.getenv("S3_PRESIGNED_URL_EXPIRES_SECONDS", "3600")),
        cleanup_local_after_s3_upload=os.getenv("CLEANUP_LOCAL_AFTER_S3_UPLOAD", "false").lower() == "true",
        cognito_region=os.getenv("COGNITO_REGION"),
        cognito_user_pool_id=os.getenv("COGNITO_USER_POOL_ID"),
        cognito_app_client_id=os.getenv("COGNITO_APP_CLIENT_ID"),
    )

settings = get_settings()
