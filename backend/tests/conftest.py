from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy import create_engine, text

from app.config import settings
from postgres_helpers import PostgresTestSchema


@pytest.fixture()
def postgres_schema() -> PostgresTestSchema:
    admin_engine = create_engine(settings.database_url, pool_pre_ping=True)
    try:
        with admin_engine.connect() as connection:
            if connection.dialect.name != "postgresql":
                pytest.skip("PostgreSQL integration tests require a PostgreSQL DATABASE_URL.")
            postgis_enabled = connection.scalar(
                text("select exists(select 1 from pg_extension where extname = 'postgis')")
            )
            if not postgis_enabled:
                pytest.skip("PostgreSQL integration tests require the PostGIS extension.")
    except Exception as exc:
        admin_engine.dispose()
        pytest.skip(f"Local PostgreSQL/PostGIS is unavailable: {exc}")

    schema_name = f"test_report_hotspot_{uuid4().hex}"
    with admin_engine.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema_name}"'))
        connection.execute(
            text(
                f'''
                CREATE TABLE "{schema_name}".alembic_version (
                    version_num varchar(32) NOT NULL,
                    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
                )
                '''
            )
        )

    test_schema = PostgresTestSchema(
        name=schema_name,
        database_url=settings.database_url,
    )

    try:
        yield test_schema
    finally:
        with admin_engine.begin() as connection:
            connection.execute(text(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE'))
        admin_engine.dispose()


@pytest.fixture()
def migrated_postgres_schema(postgres_schema: PostgresTestSchema) -> PostgresTestSchema:
    postgres_schema.run_alembic("upgrade", "head")
    return postgres_schema
