from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import time
from typing import Any

TOKEN_TTL_SECONDS = int(os.getenv("LINZIGHT_TOKEN_TTL_SECONDS", str(12 * 60 * 60)))
TOKEN_ISSUER = "linzight-rws-api"
DEFAULT_DEMO_PASSWORD = os.getenv("LINZIGHT_DEMO_PASSWORD", "Demo1234!")
PBKDF2_ITERATIONS = int(os.getenv("LINZIGHT_PASSWORD_ITERATIONS", "210000"))
PASSWORD_POLICY_MESSAGE = "password must be at least 8 characters and include letters and numbers"


def _auth_secret() -> str:
    return os.getenv("LINZIGHT_AUTH_SECRET", "linzight-local-development-secret-change-me")


def _b64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}")


def legacy_sha256_hash(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def password_meets_policy(password: str) -> bool:
    return len(password) >= 8 and bool(re.search(r"[A-Za-z]", password)) and bool(re.search(r"\d", password))


def hash_password(password: str) -> str:
    salt = secrets.token_urlsafe(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${_b64url_encode(digest)}"


def verify_password(password: str, stored_hash: str) -> bool:
    parts = stored_hash.split("$")
    if len(parts) == 4 and parts[0] == "pbkdf2_sha256":
        try:
            iterations = int(parts[1])
            salt = parts[2]
            expected = _b64url_decode(parts[3])
        except (ValueError, TypeError):
            return False
        digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), iterations)
        return hmac.compare_digest(digest, expected)

    return hmac.compare_digest(stored_hash, legacy_sha256_hash(password))


def create_access_token(user_id: str, role: str) -> str:
    now = int(time.time())
    payload = {
        "iss": TOKEN_ISSUER,
        "sub": user_id,
        "role": role,
        "iat": now,
        "exp": now + TOKEN_TTL_SECONDS,
    }
    payload_bytes = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    encoded_payload = _b64url_encode(payload_bytes)
    signature = hmac.new(_auth_secret().encode("utf-8"), encoded_payload.encode("ascii"), hashlib.sha256).digest()
    return f"lz1.{encoded_payload}.{_b64url_encode(signature)}"


def parse_access_token(token: str) -> dict[str, Any] | None:
    parts = token.split(".")
    if len(parts) != 3 or parts[0] != "lz1":
        return None
    signed_part = parts[1]
    expected_signature = hmac.new(_auth_secret().encode("utf-8"), signed_part.encode("ascii"), hashlib.sha256).digest()
    try:
        provided_signature = _b64url_decode(parts[2])
        payload = json.loads(_b64url_decode(parts[1]).decode("utf-8"))
    except (ValueError, json.JSONDecodeError):
        return None
    if not hmac.compare_digest(provided_signature, expected_signature):
        return None
    if payload.get("iss") != TOKEN_ISSUER or not payload.get("sub") or int(payload.get("exp", 0)) < int(time.time()):
        return None
    return payload
