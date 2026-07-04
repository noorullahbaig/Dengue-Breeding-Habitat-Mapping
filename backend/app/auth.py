"""Authentication and authorization middleware for Cognito JWT tokens."""

from __future__ import annotations

import os
from functools import lru_cache
from datetime import datetime, timezone
from typing import Optional

import jwt
from fastapi import Depends, Header, HTTPException, status
from jwt import PyJWKClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User


# Cognito configuration from environment
COGNITO_REGION = os.getenv("COGNITO_REGION", "")
COGNITO_USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID", "")
COGNITO_APP_CLIENT_ID = os.getenv("COGNITO_APP_CLIENT_ID", "")

# Build JWKS URL for Cognito
if COGNITO_REGION and COGNITO_USER_POOL_ID:
    COGNITO_JWKS_URL = f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}/.well-known/jwks.json"
    COGNITO_ISSUER = f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}"
else:
    COGNITO_JWKS_URL = None
    COGNITO_ISSUER = None


@lru_cache(maxsize=1)
def get_jwks_client() -> PyJWKClient:
    if not COGNITO_JWKS_URL:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cognito authentication is not configured on the server",
        )
    return PyJWKClient(COGNITO_JWKS_URL)


def verify_cognito_token(token: str) -> dict:
    """Verify and decode Cognito JWT token."""
    if not COGNITO_JWKS_URL or not COGNITO_ISSUER or not COGNITO_APP_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cognito authentication not configured on server",
        )
    
    try:
        # Get signing key from Cognito JWKS
        jwks_client = get_jwks_client()
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        
        # Verify and decode token
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=COGNITO_ISSUER,
            audience=COGNITO_APP_CLIENT_ID,
            options={"verify_exp": True},
        )
        
        # Verify token_use is 'id' (not 'access')
        if payload.get("token_use") != "id":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type. Expected ID token.",
            )
        
        return payload
        
    except HTTPException:
        raise
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {str(e)}",
        )


def get_or_create_user_from_token(payload: dict, db: Session) -> User:
    """Get or create user from Cognito token payload."""
    cognito_sub = payload.get("sub")
    if not cognito_sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject (sub) claim",
        )
    
    # Try to find existing user by cognito_sub
    user = db.scalar(select(User).where(User.cognito_sub == cognito_sub))
    
    now = datetime.now(timezone.utc)
    
    if user:
        # Update user info if it changed
        email = payload.get("email", user.email)
        display_name = payload.get("name") or payload.get("given_name") or user.display_name
        photo_url = payload.get("picture") or user.photo_url
        
        if (email != user.email or 
            display_name != user.display_name or 
            photo_url != user.photo_url):
            user.email = email
            user.display_name = display_name
            user.photo_url = photo_url
            user.updated_at = now
            db.add(user)
            db.commit()
            db.refresh(user)
        
        return user
    
    # Create new user
    new_user = User(
        id=f"cognito:{cognito_sub}",
        cognito_sub=cognito_sub,
        email=payload.get("email", ""),
        display_name=payload.get("name") or payload.get("given_name") or "User",
        photo_url=payload.get("picture"),
        provider="cognito",
        created_at=now,
        updated_at=now,
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user


async def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> User:
    """
    Dependency to get current authenticated user from Bearer token.
    
    Usage:
        @app.get("/api/my-reports")
        def my_reports(current_user: User = Depends(get_current_user)):
            # current_user is authenticated User object
            pass
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Extract Bearer token
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format. Expected: Bearer <token>",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = parts[1]
    
    # Verify token and get/create user
    payload = verify_cognito_token(token)
    user = get_or_create_user_from_token(payload, db)
    
    return user


async def get_current_user_optional(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """
    Optional authentication - returns User if authenticated, None if not.
    
    Usage:
        @app.post("/api/reports")
        def create_report(current_user: Optional[User] = Depends(get_current_user_optional)):
            # current_user is User if authenticated, None if anonymous
            pass
    """
    if not authorization:
        return None
    
    return await get_current_user(authorization, db)
