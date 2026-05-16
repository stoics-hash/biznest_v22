import base64
import hashlib
import hmac
import json
import time
from typing import Optional


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()

from core.db import SessionLocal


# ---------------------------------------------------------------------------
# DB dependency
# ---------------------------------------------------------------------------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# JWT creation (custom HS256)
# ---------------------------------------------------------------------------

def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_json(obj: dict) -> str:
    return _b64url(json.dumps(obj, separators=(",", ":"), sort_keys=True).encode("utf-8"))


def _sign(data: bytes, key: str, algorithm: str) -> bytes:
    if algorithm.upper() != "HS256":
        raise ValueError("Unsupported algorithm")
    return hmac.new(key.encode("utf-8"), data, hashlib.sha256).digest()


def create_jwt(payload: dict, key: str, algorithm: str = "HS256") -> str:
    header_b64 = _b64url_json({"alg": algorithm, "typ": "JWT"})
    payload_b64 = _b64url_json(payload)
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    signature = _b64url(_sign(signing_input, key, algorithm))
    return f"{header_b64}.{payload_b64}.{signature}"


# ---------------------------------------------------------------------------
# Password hashing (SHA256 + salt)
# ---------------------------------------------------------------------------

def hash_password(password: str, salt: Optional[str] = None) -> str:
    if salt is None:
        salt = base64.urlsafe_b64encode(
            hashlib.sha256(str(time.time_ns()).encode()).digest()
        )[:16].decode()
    digest = hashlib.sha256(f"{salt}:{password}".encode("utf-8")).hexdigest()
    return f"{salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, digest = stored.split("$", 1)
    except ValueError:
        return False
    calc = hashlib.sha256(f"{salt}:{password}".encode("utf-8")).hexdigest()
    return hmac.compare_digest(calc, digest)