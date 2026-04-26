from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from dto.UserDto import AuthResponse, LoginRequest, RegisterRequest, UserResponse
from models.user import User
from services import user_service
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