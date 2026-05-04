import uuid as _uuid

from fastapi import Depends, HTTPException, Request, Response, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from core.db import (
    ACCESS_TOKEN_EXPIRE_SECONDS,
    ALGORITHM,
    JWT_COOKIE_NAME,
    REFRESH_COOKIE_NAME,
    REFRESH_TOKEN_EXPIRE_SECONDS,
    SECRET_KEY,
    SECURE_COOKIES,
)
from models.user import User
from utils.jwtUtils import get_db


def _secure() -> bool:
    if isinstance(SECURE_COOKIES, bool):
        return SECURE_COOKIES
    return str(SECURE_COOKIES).lower() in {"1", "true", "yes", "on"}


def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=JWT_COOKIE_NAME,
        value=token,
        max_age=int(ACCESS_TOKEN_EXPIRE_SECONDS),
        httponly=True,
        secure=_secure(),
        samesite="lax",
        path="/",
    )


def set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=token,
        max_age=int(REFRESH_TOKEN_EXPIRE_SECONDS),
        httponly=True,
        secure=_secure(),
        samesite="strict",
        path="/users/refresh",
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(key=JWT_COOKIE_NAME, path="/", samesite="lax")


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(key=REFRESH_COOKIE_NAME, path="/users/refresh", samesite="strict")


def get_token(request: Request) -> str | None:
    token = request.cookies.get(JWT_COOKIE_NAME)
    if token:
        return token
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return None
    parts = auth_header.strip().split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None


def get_refresh_token(request: Request, body_token: str | None = None) -> str | None:
    """Cookie-first; falls back to body field (mobile clients)."""
    return request.cookies.get(REFRESH_COOKIE_NAME) or body_token


def get_authenticated_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = get_token(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        user_id = _uuid.UUID(sub)
    except (JWTError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")
    return user