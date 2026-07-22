from __future__ import annotations

import os
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import NullPool


BACKEND_DIR = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class PostgresTestSchema:
    name: str
    database_url: str

    def engine(self) -> Engine:
        return create_engine(
            self.database_url,
            pool_pre_ping=True,
            connect_args={"options": f"-csearch_path={self.name},public"},
            poolclass=NullPool,
        )

    def session(self) -> Session:
        return Session(self.engine())

    def run_alembic(self, *arguments: str) -> None:
        environment = os.environ.copy()
        environment["DATABASE_URL"] = self.database_url
        environment["PGOPTIONS"] = f"-csearch_path={self.name},public"
        subprocess.run(
            [sys.executable, "-m", "alembic", *arguments],
            cwd=BACKEND_DIR,
            env=environment,
            check=True,
            capture_output=True,
            text=True,
        )
