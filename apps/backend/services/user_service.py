import time

from fastapi import HTTPException, Response, status
from sqlalchemy.orm import Session

from core.db import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_SECONDS
from dto.UserDto import AuthResponse, RegisterRequest, LoginRequest, UserResponse
from models.investor_subscription import InvestorSubscription
from models.subscription_plan import SubscriptionPlan
from models.user import User
from models.role import Role
from models.user_role import UserRole
from utils.jwtUtils import create_jwt, hash_password, verify_password
from services.auth_service import set_auth_cookie, clear_auth_cookie


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

    token = _issue_token(user)
    set_auth_cookie(response, token)
    return AuthResponse(id=user.id, email=user.email, username=user.username, token=token)


def login(payload: LoginRequest, response: Response, db: Session) -> AuthResponse:
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User is inactive")

    token = _issue_token(user)
    set_auth_cookie(response, token)
    return AuthResponse(id=user.id, email=user.email, username=user.username, token=token)


def logout(response: Response) -> None:
    clear_auth_cookie(response)


def get_all_users(db: Session) -> list[UserResponse]:
    return db.query(User).all()


def _issue_token(user: User) -> str:
    now = int(time.time())
    return create_jwt(
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