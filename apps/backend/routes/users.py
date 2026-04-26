from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from dto.UserDto import (
    AuthResponse,
    LoginRequest,
    LguInviteRequest,
    LguInviteResponse,
    LguRegisterRequest,
    RegisterRequest,
    TokenVerifyResponse,
    UserResponse,
)
from models.user import User
from services import lgu_invitation_service, user_service
from utils.jwtUtils import get_db
from services.auth_service import get_authenticated_user

router = APIRouter(tags=["users"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, response: Response, db: Session = Depends(get_db)):
    return user_service.register(payload, response, db)


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    return user_service.login(payload, response, db)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    user_service.logout(response)


@router.get("/me", response_model=UserResponse)
def current_user(auth_user: User = Depends(get_authenticated_user)):
    return auth_user


@router.get("/", response_model=list[UserResponse])
def all_users(db: Session = Depends(get_db)):
    return user_service.get_all_users(db)


# LGU admin magic-link invitation flow

@router.post(
    "/lgu/invite",
    response_model=LguInviteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Send LGU admin registration invite (superuser only)",
)
def invite_lgu_admin(
    payload: LguInviteRequest,
    auth_user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
):
    return lgu_invitation_service.create_invitation(payload, auth_user, db)


@router.get(
    "/lgu/verify-invitation",
    response_model=TokenVerifyResponse,
    summary="Verify an LGU invitation token before showing the registration form",
)
def verify_lgu_invitation(token: str, email: str, db: Session = Depends(get_db)):
    return lgu_invitation_service.verify_invitation(token, email, db)


@router.post(
    "/lgu/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Complete LGU admin registration using a magic-link token",
)
def register_lgu_admin(
    payload: LguRegisterRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    return lgu_invitation_service.register_from_token(payload, response, db)