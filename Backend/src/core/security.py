import base64
import json
import logging
import time
import uuid
from functools import lru_cache

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwcrypto import jwe, jwk
from jwcrypto.common import JWException
from pydantic import BaseModel

from src.core.config import get_settings

logger = logging.getLogger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)


class CurrentUser(BaseModel):
    id: str
    email: str | None = None
    name: str | None = None


def _unauthorized(detail: str = "Invalid or expired token") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


@lru_cache(maxsize=16)
def _derive_key(secret: str, salt: str) -> jwk.JWK:
    """Derive the Auth.js v5 JWE key (A256CBC-HS512 needs 64 bytes) via HKDF-SHA256."""
    derived = HKDF(
        algorithm=hashes.SHA256(),
        length=64,
        salt=salt.encode(),
        info=f"Auth.js Generated Encryption Key ({salt})".encode(),
    ).derive(secret.encode())
    k = base64.urlsafe_b64encode(derived).rstrip(b"=").decode()
    return jwk.JWK(kty="oct", k=k)


def _decrypt(token: str, secret: str, salt: str) -> dict:
    token_obj = jwe.JWE()
    token_obj.deserialize(token, key=_derive_key(secret, salt))
    payload = json.loads(token_obj.payload)
    if not isinstance(payload, dict):
        raise ValueError("Unexpected token payload")
    return payload


def decode_authjs_token(token: str) -> dict:
    settings = get_settings()
    for salt in settings.auth_cookie_salts:
        try:
            return _decrypt(token, settings.auth_secret, salt)
        except (JWException, ValueError, TypeError, UnicodeError) as exc:
            logger.debug("Auth.js token decryption failed for salt %r: %s", salt, exc)
            continue
    raise _unauthorized()


bearer_scheme_ = Depends(bearer_scheme)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = bearer_scheme_,
) -> CurrentUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _unauthorized("Missing bearer token")

    payload = decode_authjs_token(credentials.credentials)
    exp = payload.get("exp")
    if exp is not None and float(exp) < time.time():
        raise _unauthorized("Token expired")

    user_id = payload.get("sub") or payload.get("id") or payload.get("user_id")
    if not user_id:
        raise _unauthorized("Token has no subject")

    return CurrentUser(
        id=str(user_id), email=payload.get("email"), name=payload.get("name")
    )


async def get_chat_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = bearer_scheme_,
) -> CurrentUser:
    """Allow authenticated users or an isolated, browser-scoped guest chat."""
    
    if credentials is not None and credentials.scheme.lower() == "bearer":
        return await get_current_user(credentials)

    guest_id = request.headers.get("x-guest-id", "")
    try:
        guest_uuid = uuid.UUID(guest_id)
    except ValueError, AttributeError:
        raise _unauthorized("A valid guest chat id is required") from None

    return CurrentUser(id=f"guest:{guest_uuid}", name="Guest")
