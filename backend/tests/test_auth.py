from __future__ import annotations

import asyncio

import pytest
from fastapi import HTTPException

from app import auth


def test_cognito_decode_validates_the_configured_audience(monkeypatch):
    captured: dict[str, object] = {}

    class SigningKey:
        key = "public-key"

    class JwksClient:
        def get_signing_key_from_jwt(self, token: str):
            assert token == "token"
            return SigningKey()

    def fake_decode(token, key, **kwargs):
        captured.update(kwargs)
        return {"sub": "user", "token_use": "id", "aud": "client"}

    monkeypatch.setattr(auth, "COGNITO_ISSUER", "https://issuer.example")
    monkeypatch.setattr(auth, "COGNITO_JWKS_URL", "https://issuer.example/jwks.json")
    monkeypatch.setattr(auth, "COGNITO_APP_CLIENT_ID", "client")
    monkeypatch.setattr(auth, "get_jwks_client", lambda: JwksClient())
    monkeypatch.setattr(auth.jwt, "decode", fake_decode)

    auth.verify_cognito_token("token")

    assert captured["audience"] == "client"
    assert captured["issuer"] == "https://issuer.example"
    assert captured["algorithms"] == ["RS256"]


def test_optional_auth_rejects_an_invalid_present_token(monkeypatch):
    async def reject_token(*_args, **_kwargs):
        raise HTTPException(status_code=401, detail="invalid")

    monkeypatch.setattr(auth, "get_current_user", reject_token)

    with pytest.raises(HTTPException) as error:
        asyncio.run(auth.get_current_user_optional("Bearer invalid", db=object()))

    assert error.value.status_code == 401


def test_cognito_decode_rejects_access_tokens(monkeypatch):
    class SigningKey:
        key = "public-key"

    class JwksClient:
        def get_signing_key_from_jwt(self, _token: str):
            return SigningKey()

    monkeypatch.setattr(auth, "COGNITO_ISSUER", "https://issuer.example")
    monkeypatch.setattr(auth, "COGNITO_JWKS_URL", "https://issuer.example/jwks.json")
    monkeypatch.setattr(auth, "COGNITO_APP_CLIENT_ID", "client")
    monkeypatch.setattr(auth, "get_jwks_client", lambda: JwksClient())
    monkeypatch.setattr(
        auth.jwt,
        "decode",
        lambda *_args, **_kwargs: {"sub": "user", "token_use": "access"},
    )

    with pytest.raises(HTTPException) as error:
        auth.verify_cognito_token("token")

    assert error.value.status_code == 401


@pytest.mark.parametrize(
    "exception",
    [auth.jwt.ExpiredSignatureError(), auth.jwt.InvalidAudienceError("wrong audience")],
)
def test_cognito_decode_rejects_expired_or_wrong_audience_tokens(monkeypatch, exception):
    class SigningKey:
        key = "public-key"

    class JwksClient:
        def get_signing_key_from_jwt(self, _token: str):
            return SigningKey()

    def reject(*_args, **_kwargs):
        raise exception

    monkeypatch.setattr(auth, "COGNITO_ISSUER", "https://issuer.example")
    monkeypatch.setattr(auth, "COGNITO_JWKS_URL", "https://issuer.example/jwks.json")
    monkeypatch.setattr(auth, "COGNITO_APP_CLIENT_ID", "client")
    monkeypatch.setattr(auth, "get_jwks_client", lambda: JwksClient())
    monkeypatch.setattr(auth.jwt, "decode", reject)

    with pytest.raises(HTTPException) as error:
        auth.verify_cognito_token("token")

    assert error.value.status_code == 401
