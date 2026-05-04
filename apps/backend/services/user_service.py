import secrets
import time
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Response, status
from sqlalchemy.orm import Session

from core.db import ACCESS_TOKEN_EXPIRE_SECONDS, ALGORITHM, REFRESH_TOKEN_EXPIRE_SECONDS, SECRET_KEY
from dto.UserDto import AuthResponse, LoginRequest, RegisterRequest, UserResponse
from models.investor_subscription import InvestorSubscription
from models.refresh_token import RefreshToken
from models.role import Role
from models.subscription_plan import SubscriptionPlan
from models.user import User
from models.user_role import UserRole
from services.auth_service import (
    clear_auth_cookie,
    clear_refresh_cookie,
    set_auth_cookie,
    set_refresh_cookie,
)
from utils.jwtUtils import create_jwt, hash_password, hash_token, verify_password


def register(payload: RegisterRequest, response: Response, db: Session) -> AuthResponse:
    existing = db.query(User).filter(
        (User.username == payload.username) | (User.email == payload.email)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with given username or email already exists")

    user = User(
        email=payload.email,
        username=payload.username,
        hashed_password=hash_password(payload.password),
        is_active=True,
        is_superuser=False,
    )
    db.add(user)
    db.flush()

    investor_role = db.query(Role).filter(Role.name == "investor").first()
    if investor_role:
        db.add(UserRole(user_id=user.id, role_id=investor_role.id))

    free_plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.name == "free").first()
    if free_plan:
        db.add(InvestorSubscription(user_id=user.id, plan_id=free_plan.id))

    db.commit()
    db.refresh(user)

    access_token, raw_refresh = create_auth_session(user, response, db)
    return _auth_response(user, access_token, raw_refresh)


def login(payload: LoginRequest, response: Response, db: Session) -> AuthResponse:
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User is inactive")

    access_token, raw_refresh = create_auth_session(user, response, db)
    return _auth_response(user, access_token, raw_refresh)


def logout(response: Response, raw_refresh_token: str | None, db: Session) -> None:
    if raw_refresh_token:
        rt = db.query(RefreshToken).filter(
            RefreshToken.token_hash == hash_token(raw_refresh_token)
        ).first()
        if rt and rt.revoked_at is None:
            rt.revoked_at = datetime.now(timezone.utc)
            db.commit()
    clear_auth_cookie(response)
    clear_refresh_cookie(response)


def logout_all(user: User, response: Response, db: Session) -> None:
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user.id,
        RefreshToken.revoked_at.is_(None),
    ).update({"revoked_at": datetime.now(timezone.utc)})
    db.commit()
    clear_auth_cookie(response)
    clear_refresh_cookie(response)


def refresh_tokens(raw_refresh_token: str, response: Response, db: Session) -> AuthResponse:
    rt = db.query(RefreshToken).filter(
        RefreshToken.token_hash == hash_token(raw_refresh_token)
    ).first()

    if not rt:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    if rt.revoked_at is not None:
        # Reuse of a revoked token — possible theft, invalidate all sessions
        db.query(RefreshToken).filter(RefreshToken.user_id == rt.user_id).update(
            {"revoked_at": datetime.now(timezone.utc)}
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token reuse detected — all sessions revoked",
        )

    expires = rt.expires_at if rt.expires_at.tzinfo else rt.expires_at.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired")

    user = db.query(User).filter(User.id == rt.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User inactive")

    # Rotate: revoke old, issue new
    rt.revoked_at = datetime.now(timezone.utc)
    db.flush()

    access_token, raw_refresh = create_auth_session(user, response, db)
    return _auth_response(user, access_token, raw_refresh)


def get_all_users(db: Session) -> list[UserResponse]:
    return db.query(User).all()


def create_auth_session(user: User, response: Response, db: Session) -> tuple[str, str]:
    """Mint access + refresh tokens, persist refresh hash, set both cookies."""
    now = int(time.time())
    access_token = create_jwt(
        {
            "sub": str(user.id),
            "username": user.username,
            "email": user.email,
            "iat": now,
            "exp": now + int(ACCESS_TOKEN_EXPIRE_SECONDS),
        },
        key=SECRET_KEY,
        algorithm=ALGORITHM,
    )

    raw_refresh = secrets.token_urlsafe(32)
    db.add(RefreshToken(
        user_id=user.id,
        token_hash=hash_token(raw_refresh),
        expires_at=datetime.now(timezone.utc) + timedelta(seconds=int(REFRESH_TOKEN_EXPIRE_SECONDS)),
    ))
    db.commit()

    set_auth_cookie(response, access_token)
    set_refresh_cookie(response, raw_refresh)
    return access_token, raw_refresh


def _auth_response(user: User, access_token: str, refresh_token: str) -> AuthResponse:
    return AuthResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=int(ACCESS_TOKEN_EXPIRE_SECONDS),
    )