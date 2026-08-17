import base64
import hashlib
import logging
import os

from fastapi import APIRouter, Depends, HTTPException

from ..config import settings
from ..dependencies import require_role

logger = logging.getLogger(__name__)

router = APIRouter()

_Fernet = None


def _get_fernet():
    """Lazy-load Fernet with key derived from settings.encryption_key."""
    global _Fernet
    if _Fernet is not None:
        return _Fernet
    key = settings.encryption_key
    if len(key) < 32:
        raise RuntimeError("ENCRYPTION_KEY must be at least 32 characters")
    from cryptography.fernet import Fernet
    # Derive a valid Fernet key (url-safe base64-encoded 32 bytes)
    derived = base64.urlsafe_b64encode(hashlib.sha256(key.encode()).digest())
    _Fernet = Fernet(derived)
    return _Fernet


def encrypt_value(plaintext: str) -> str:
    """Encrypt a string value using Fernet. Returns base64-encoded ciphertext."""
    fernet = _get_fernet()
    return fernet.encrypt(plaintext.encode()).decode()


def decrypt_value(ciphertext: str) -> str:
    """Decrypt a Fernet-encrypted string. Raises cryptography.fernet.InvalidToken on bad input."""
    fernet = _get_fernet()
    return fernet.decrypt(ciphertext.encode()).decode()


def is_encrypted(value: str) -> bool:
    """Check if a value looks like a Fernet token (starts with 'gAAAAA')."""
    return isinstance(value, str) and value.startswith("gAAAAA")


class EncryptionService:
    def check_encryption_status(self) -> dict:
        db_encrypted = len(settings.encryption_key) >= 32
        s3_encrypted = (
            settings.storage_access_key != "minioadmin"
            and settings.storage_secret_key != "minioadmin"
        )
        backup_encrypted = db_encrypted and s3_encrypted
        return {
            "database_encrypted": db_encrypted,
            "s3_encryption": s3_encrypted,
            "backup_encryption": backup_encrypted,
            "fernet_available": _fernet_available(),
        }


def _fernet_available() -> bool:
    try:
        from cryptography.fernet import Fernet
        return True
    except ImportError:
        return False


encryption_service = EncryptionService()


@router.get("/security/encryption-status")
async def get_encryption_status(
    _admin: dict = Depends(require_role("admin")),
):
    return encryption_service.check_encryption_status()
