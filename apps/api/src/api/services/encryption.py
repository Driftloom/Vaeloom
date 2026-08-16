import os

from fastapi import APIRouter, Depends, HTTPException

from ..config import settings
from ..dependencies import require_role

router = APIRouter()


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
        }


encryption_service = EncryptionService()


@router.get("/security/encryption-status")
async def get_encryption_status(
    _admin: dict = Depends(require_role("admin")),
):
    return encryption_service.check_encryption_status()