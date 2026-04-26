from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, constr


class RegisterRequest(BaseModel):
    email: EmailStr
    username: constr(min_length=3, max_length=50)
    password: constr(min_length=6)


class LguInviteRequest(BaseModel):
    email: EmailStr
    city_id: UUID


class LguInviteResponse(BaseModel):
    message: str
    magic_link: str
    city_id: UUID
    expires_at: datetime


class LguRegisterRequest(BaseModel):
    token: str
    email: EmailStr
    username: constr(min_length=3, max_length=50)
    password: constr(min_length=6)


class TokenVerifyResponse(BaseModel):
    valid: bool
    email: str


class LoginRequest(BaseModel):
    username: str
    password: str


class AuthResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    username: str
    token: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    username: str
    is_active: bool
    is_superuser: bool
    created_at: datetime
    updated_at: datetime