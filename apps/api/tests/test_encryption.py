import pytest
from unittest.mock import patch

from api.services.encryption import EncryptionService


class TestEncryptionService:
    def setup_method(self):
        self.service = EncryptionService()

    def test_encryption_status_returns_dict_with_three_keys(self):
        result = self.service.check_encryption_status()
        assert isinstance(result, dict)
        assert "database_encrypted" in result
        assert "s3_encryption" in result
        assert "backup_encryption" in result

    def test_database_encrypted_false_when_key_short(self):
        with patch("api.services.encryption.settings") as mock_settings:
            mock_settings.encryption_key = "short"
            result = self.service.check_encryption_status()
            assert result["database_encrypted"] is False

    def test_database_encrypted_true_when_key_long_enough(self):
        with patch("api.services.encryption.settings") as mock_settings:
            mock_settings.encryption_key = "a" * 32
            result = self.service.check_encryption_status()
            assert result["database_encrypted"] is True

    def test_s3_encryption_false_with_default_creds(self):
        with patch("api.services.encryption.settings") as mock_settings:
            mock_settings.storage_access_key = "minioadmin"
            mock_settings.storage_secret_key = "minioadmin"
            result = self.service.check_encryption_status()
            assert result["s3_encryption"] is False

    def test_s3_encryption_true_with_custom_creds(self):
        with patch("api.services.encryption.settings") as mock_settings:
            mock_settings.storage_access_key = "custom-key"
            mock_settings.storage_secret_key = "custom-secret"
            result = self.service.check_encryption_status()
            assert result["s3_encryption"] is True

    def test_backup_encryption_mirrors_both(self):
        with patch("api.services.encryption.settings") as mock_settings:
            mock_settings.encryption_key = "a" * 32
            mock_settings.storage_access_key = "custom"
            mock_settings.storage_secret_key = "custom"
            result = self.service.check_encryption_status()
            assert result["backup_encryption"] is True

    def test_backup_encryption_false_if_db_not_encrypted(self):
        with patch("api.services.encryption.settings") as mock_settings:
            mock_settings.encryption_key = "short"
            mock_settings.storage_access_key = "custom"
            mock_settings.storage_secret_key = "custom"
            result = self.service.check_encryption_status()
            assert result["backup_encryption"] is False

    @pytest.mark.asyncio
    async def test_endpoint_requires_admin(self, client):
        response = await client.get("/api/v1/security/encryption-status")
        assert response.status_code in (401, 403)