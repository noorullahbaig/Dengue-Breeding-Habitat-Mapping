from __future__ import annotations

from app.production_env import parse_env_file, validate_production_env


def make_valid_env() -> dict[str, str]:
    return {
        "DATABASE_URL": "postgresql+psycopg://user:secret@db.example.com:5432/denguewatch",
        "CORS_ORIGINS": "https://denguewatch.example.com",
        "STORAGE_BACKEND": "s3",
        "S3_BUCKET": "denguewatch-production-uploads",
        "S3_REGION": "ap-southeast-1",
        "COGNITO_REGION": "us-east-1",
        "COGNITO_USER_POOL_ID": "us-east-1_realpool123",
        "COGNITO_APP_CLIENT_ID": "1h57kf5cpq17m0eml12EXAMPLE",
        "VITE_AUTH_MODE": "cognito",
        "VITE_API_BASE_URL": "/api",
        "VITE_COGNITO_REGION": "us-east-1",
        "VITE_COGNITO_USER_POOL_ID": "us-east-1_realpool123",
        "VITE_COGNITO_USER_POOL_CLIENT_ID": "1h57kf5cpq17m0eml12EXAMPLE",
        "VITE_COGNITO_HOSTED_UI_DOMAIN": "auth.denguewatch.example.com",
        "VITE_COGNITO_REDIRECT_SIGN_IN": "https://denguewatch.example.com/profile",
        "VITE_COGNITO_REDIRECT_SIGN_OUT": "https://denguewatch.example.com/",
    }


def test_parse_env_file_collects_values_and_duplicate_keys(tmp_path):
    env_file = tmp_path / ".env.production"
    env_file.write_text(
        "\n".join(
            [
                "# comment",
                "DATABASE_URL=postgresql+psycopg://user:secret@db.example.com:5432/denguewatch",
                "CORS_ORIGINS=https://denguewatch.example.com",
                "DATABASE_URL=postgresql+psycopg://user:secret@db-2.example.com:5432/denguewatch",
                "",
            ]
        )
    )

    parsed = parse_env_file(env_file)

    assert parsed.values["DATABASE_URL"].endswith("@db-2.example.com:5432/denguewatch")
    assert parsed.duplicates == {"DATABASE_URL": [2, 4]}


def test_validate_production_env_accepts_matching_cognito_configuration():
    result = validate_production_env(make_valid_env())

    assert result.errors == []
    assert result.warnings == []


def test_validate_production_env_rejects_missing_required_keys():
    env = make_valid_env()
    env.pop("DATABASE_URL")

    result = validate_production_env(env)

    assert "Missing required variable: DATABASE_URL" in result.errors


def test_validate_production_env_rejects_placeholder_values():
    env = make_valid_env()
    env["CORS_ORIGINS"] = "http://YOUR_EC2_PUBLIC_IP"

    result = validate_production_env(env)

    assert any("placeholder" in error.lower() for error in result.errors)


def test_validate_production_env_rejects_cognito_mismatch():
    env = make_valid_env()
    env["VITE_COGNITO_USER_POOL_CLIENT_ID"] = "different-client-id"

    result = validate_production_env(env)

    assert "Backend and frontend Cognito app client IDs must match" in result.errors


def test_validate_production_env_requires_s3_bucket_when_s3_storage_is_enabled():
    env = make_valid_env()
    env.pop("S3_BUCKET")

    result = validate_production_env(env)

    assert "S3_BUCKET is required when STORAGE_BACKEND=s3" in result.errors


def test_validate_production_env_warns_when_api_base_url_is_not_same_origin():
    env = make_valid_env()
    env["VITE_API_BASE_URL"] = "https://api.denguewatch.example.com"

    result = validate_production_env(env)

    assert result.errors == []
    assert "VITE_API_BASE_URL should usually be /api in production" in result.warnings
