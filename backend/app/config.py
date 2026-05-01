from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / ".env")


@dataclass(frozen=True)
class Settings:
    database_url: str
    model_path: Path
    upload_root: Path
    cors_origins: list[str]
    max_upload_bytes: int = 10 * 1024 * 1024


def _resolve_path(value: str) -> Path:
    path = Path(value).expanduser()
    if not path.is_absolute():
        return (BASE_DIR / path).resolve()
    return path.resolve()


def get_settings() -> Settings:
    cors_origins = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
        if origin.strip()
    ]

    return Settings(
        database_url=os.getenv(
            "DATABASE_URL",
            "postgresql+psycopg://noorullah@localhost:5432/codex_fyp",
        ),
        model_path=_resolve_path(os.getenv("MODEL_PATH", "/Users/noorullah/Downloads/best.pt")),
        upload_root=_resolve_path(os.getenv("UPLOAD_ROOT", "./uploads")),
        cors_origins=cors_origins,
    )


settings = get_settings()
