from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse


REQUIRED_KEYS = (
    "DATABASE_URL",
    "CORS_ORIGINS",
    "VITE_API_BASE_URL",
)

COGNITO_BACKEND_KEYS = (
    "COGNITO_REGION",
    "COGNITO_USER_POOL_ID",
    "COGNITO_APP_CLIENT_ID",
)

COGNITO_FRONTEND_KEYS = (
    "VITE_COGNITO_REGION",
    "VITE_COGNITO_USER_POOL_ID",
    "VITE_COGNITO_USER_POOL_CLIENT_ID",
    "VITE_COGNITO_HOSTED_UI_DOMAIN",
    "VITE_COGNITO_REDIRECT_SIGN_IN",
    "VITE_COGNITO_REDIRECT_SIGN_OUT",
)

PLACEHOLDER_SNIPPETS = (
    "YOUR_",
    "XXXXX",
    "XXXXXXXXX",
    "1234567890ABCDEFGHIJKLMNOP",
    "YOUR-DOMAIN.COM",
)


@dataclass(frozen=True)
class ParsedEnvFile:
    values: dict[str, str]
    duplicates: dict[str, list[int]]


@dataclass(frozen=True)
class ValidationResult:
    errors: list[str]
    warnings: list[str]


def parse_env_file(path: str | Path) -> ParsedEnvFile:
    values: dict[str, str] = {}
    seen: dict[str, list[int]] = {}
    env_path = Path(path)

    for line_number, raw_line in enumerate(env_path.read_text().splitlines(), start=1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        if line.startswith("export "):
            line = line[7:].strip()

        if "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        values[key] = value
        seen.setdefault(key, []).append(line_number)

    duplicates = {key: lines for key, lines in seen.items() if len(lines) > 1}
    return ParsedEnvFile(values=values, duplicates=duplicates)


def validate_production_env(values: dict[str, str], *, duplicates: dict[str, list[int]] | None = None) -> ValidationResult:
    errors: list[str] = []
    warnings: list[str] = []
    duplicates = duplicates or {}

    for key in REQUIRED_KEYS:
        if not _has_value(values, key):
            errors.append(f"Missing required variable: {key}")

    for key, lines in duplicates.items():
        errors.append(f"Duplicate variable {key} declared on lines {', '.join(str(line) for line in lines)}")

    for key, value in values.items():
        if _looks_like_placeholder(value):
            errors.append(f"{key} still contains a placeholder value")

    database_url = values.get("DATABASE_URL", "")
    if database_url and not database_url.startswith(("postgresql://", "postgresql+psycopg://")):
        errors.append("DATABASE_URL must be a PostgreSQL connection string")

    cors_origins = values.get("CORS_ORIGINS", "")
    if cors_origins:
        for origin in (item.strip() for item in cors_origins.split(",") if item.strip()):
            if not _is_http_url(origin):
                errors.append(f"CORS_ORIGINS contains an invalid origin: {origin}")

    storage_backend = values.get("STORAGE_BACKEND", "").strip().lower()
    if storage_backend != "s3":
        errors.append("STORAGE_BACKEND must be s3 in production")
    else:
        if not _has_value(values, "S3_BUCKET"):
            errors.append("S3_BUCKET is required when STORAGE_BACKEND=s3")
        if not _has_value(values, "S3_REGION"):
            errors.append("S3_REGION is required when STORAGE_BACKEND=s3")

    auth_mode = values.get("VITE_AUTH_MODE", "cognito").strip().lower()
    if auth_mode == "cognito":
        for key in (*COGNITO_BACKEND_KEYS, *COGNITO_FRONTEND_KEYS):
            if not _has_value(values, key):
                errors.append(f"Missing required variable for Cognito mode: {key}")

        if _has_value(values, "COGNITO_REGION") and _has_value(values, "VITE_COGNITO_REGION"):
            if values["COGNITO_REGION"] != values["VITE_COGNITO_REGION"]:
                errors.append("Backend and frontend Cognito regions must match")

        if _has_value(values, "COGNITO_USER_POOL_ID") and _has_value(values, "VITE_COGNITO_USER_POOL_ID"):
            if values["COGNITO_USER_POOL_ID"] != values["VITE_COGNITO_USER_POOL_ID"]:
                errors.append("Backend and frontend Cognito user pool IDs must match")

        if _has_value(values, "COGNITO_APP_CLIENT_ID") and _has_value(values, "VITE_COGNITO_USER_POOL_CLIENT_ID"):
            if values["COGNITO_APP_CLIENT_ID"] != values["VITE_COGNITO_USER_POOL_CLIENT_ID"]:
                errors.append("Backend and frontend Cognito app client IDs must match")

        hosted_ui_domain = values.get("VITE_COGNITO_HOSTED_UI_DOMAIN", "")
        if hosted_ui_domain and ("://" in hosted_ui_domain or "/" in hosted_ui_domain):
            errors.append("VITE_COGNITO_HOSTED_UI_DOMAIN must be a bare domain without a scheme or path")

        for key in ("VITE_COGNITO_REDIRECT_SIGN_IN", "VITE_COGNITO_REDIRECT_SIGN_OUT"):
            redirect = values.get(key, "")
            if redirect and not _is_http_url(redirect):
                errors.append(f"{key} must be an absolute HTTP or HTTPS URL")

    api_base_url = values.get("VITE_API_BASE_URL", "")
    if api_base_url and api_base_url != "/api":
        warnings.append("VITE_API_BASE_URL should usually be /api in production")

    return ValidationResult(errors=errors, warnings=warnings)


def validate_env_file(path: str | Path) -> ValidationResult:
    parsed = parse_env_file(path)
    return validate_production_env(parsed.values, duplicates=parsed.duplicates)


def _has_value(values: dict[str, str], key: str) -> bool:
    return bool(values.get(key, "").strip())


def _looks_like_placeholder(value: str) -> bool:
    stripped = value.strip()
    if not stripped:
        return False

    upper_value = stripped.upper()
    return any(snippet in upper_value for snippet in PLACEHOLDER_SNIPPETS)


def _is_http_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


if __name__ == "__main__":
    import argparse
    import sys

    parser = argparse.ArgumentParser(description="Validate DengueWatch production environment files.")
    parser.add_argument("env_file", help="Path to the env file to validate")
    args = parser.parse_args()

    result = validate_env_file(args.env_file)
    for warning in result.warnings:
        print(f"WARNING: {warning}", file=sys.stderr)
    for error in result.errors:
        print(f"ERROR: {error}", file=sys.stderr)

    sys.exit(1 if result.errors else 0)
