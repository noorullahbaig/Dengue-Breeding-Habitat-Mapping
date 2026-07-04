from __future__ import annotations

import hashlib
import secrets


def create_claim_token() -> str:
    return secrets.token_urlsafe(32)


def hash_claim_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
