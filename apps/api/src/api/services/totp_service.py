"""Zero-Trust RFC 6238 TOTP Multi-Factor Authentication Service.

Provides cryptographic Base32 secret generation, otpauth:// URI formatting,
6-digit code verification with clock drift tolerance, recovery code management,
and short-lived signed MFA challenge tokens.
"""

import base64
import hashlib
import hmac
import secrets
import struct
import time
from typing import Any
import jwt

from ..config import settings


class TOTPService:
    STEP_SECONDS = 30
    DIGITS = 6

    @classmethod
    def generate_secret(cls, length: int = 20) -> str:
        """Generate a random Base32 secret key."""
        random_bytes = secrets.token_bytes(length)
        return base64.b32encode(random_bytes).decode("ascii").rstrip("=")

    @classmethod
    def get_totp_uri(cls, secret: str, email: str, issuer: str = "Vaeloom") -> str:
        """Generate an otpauth:// URI for QR code generation."""
        from urllib.parse import quote
        label = quote(f"{issuer}:{email}")
        issuer_quoted = quote(issuer)
        return f"otpauth://totp/{label}?secret={secret}&issuer={issuer_quoted}&algorithm=SHA1&digits={cls.DIGITS}&period={cls.STEP_SECONDS}"

    @classmethod
    def generate_code(cls, secret: str, for_time: float | None = None) -> str:
        """Generate a 6-digit TOTP code for a given timestamp."""
        if for_time is None:
            for_time = time.time()
        counter = int(for_time // cls.STEP_SECONDS)

        # Pad secret to valid Base32 length if padding was stripped
        padding = (8 - len(secret) % 8) % 8
        secret_padded = secret + ("=" * padding)
        key = base64.b32decode(secret_padded, casefold=True)

        counter_bytes = struct.pack(">Q", counter)
        hmac_digest = hmac.new(key, counter_bytes, hashlib.sha1).digest()

        # Dynamic truncation (RFC 4226 Section 5.4)
        offset = hmac_digest[-1] & 0x0F
        code_int = struct.unpack(">I", hmac_digest[offset : offset + 4])[0] & 0x7FFFFFFF
        code = code_int % (10**cls.DIGITS)
        return f"{code:0{cls.DIGITS}d}"

    @classmethod
    def verify_code(cls, secret: str, code: str, window: int = 1) -> bool:
        """Verify a TOTP code with clock drift tolerance (default ±1 step / 30s)."""
        if not secret or not code or len(code.strip()) != cls.DIGITS:
            return False

        code_clean = code.strip()
        now = time.time()

        for step_offset in range(-window, window + 1):
            t = now + (step_offset * cls.STEP_SECONDS)
            expected_code = cls.generate_code(secret, for_time=t)
            if hmac.compare_digest(expected_code, code_clean):
                return True
        return False

    @classmethod
    def generate_recovery_codes(cls, count: int = 8) -> tuple[list[str], list[str]]:
        """Generate plaintext recovery codes and their SHA-256 hashes.
        
        Returns:
            (plaintext_codes, hashed_codes)
        """
        plaintext = []
        hashes = []
        for _ in range(count):
            # Format: 5 alphanumeric - 5 alphanumeric (e.g., A7X9K-2M8PL)
            p1 = secrets.token_hex(3).upper()[:5]
            p2 = secrets.token_hex(3).upper()[:5]
            code = f"{p1}-{p2}"
            plaintext.append(code)
            hashes.append(hashlib.sha256(code.encode()).hexdigest())
        return plaintext, hashes

    @classmethod
    def verify_recovery_code(cls, code: str, hashed_codes: list[str]) -> tuple[bool, list[str]]:
        """Verify and consume a single-use recovery code.
        
        Returns:
            (is_valid, remaining_hashed_codes)
        """
        normalized = code.strip().upper()
        h = hashlib.sha256(normalized.encode()).hexdigest()
        for idx, stored_hash in enumerate(hashed_codes):
            if hmac.compare_digest(stored_hash, h):
                remaining = [c for i, c in enumerate(hashed_codes) if i != idx]
                return True, remaining
        return False, hashed_codes

    @classmethod
    def create_mfa_challenge_token(cls, user_id: str) -> str:
        """Create a short-lived (5 min) JWT challenge token for 2FA login."""
        now = int(time.time())
        payload = {
            "sub": user_id,
            "type": "mfa_challenge",
            "iat": now,
            "exp": now + 300,
        }
        return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)

    @classmethod
    def verify_mfa_challenge_token(cls, token: str) -> str | None:
        """Verify short-lived MFA challenge token and return user_id."""
        try:
            payload = jwt.decode(
                token,
                settings.jwt_secret,
                algorithms=[settings.jwt_algorithm],
                options={"require": ["exp", "sub"]},
            )
            if payload.get("type") != "mfa_challenge":
                return None
            return payload.get("sub")
        except jwt.PyJWTError:
            return None


totp_service = TOTPService()
