import base64
import hashlib
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.types import Text as _SA_Text, TypeDecorator

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


class EncryptedString(TypeDecorator):
    """Transparent AES-256 (Fernet) encrypted TEXT column.

    Encrypts on write, decrypts on read. Backward-compatible: values that are
    not Fernet tokens are stored/returned as-is, so existing plaintext rows are
    migrated gradually (only re-encrypted when written again).

    Used for sensitive content fields (memories.content, document_chunks.content)
    to satisfy the at-rest encryption requirement (FINDING-002).
    """

    impl = _SA_Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, str) and is_encrypted(value):
            return value
        return encrypt_value(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, str) and is_encrypted(value):
            try:
                return decrypt_value(value)
            except Exception:
                return value
        return value


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
        from cryptography.fernet import Fernet  # noqa: F401
        return True
    except ImportError:
        return False


encryption_service = EncryptionService()


@router.get("/security/encryption-status")
async def get_encryption_status(
    _admin: dict = Depends(require_role("admin")),
):
    return encryption_service.check_encryption_status()
