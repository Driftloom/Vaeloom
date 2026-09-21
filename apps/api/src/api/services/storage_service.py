import asyncio
import logging

from ..config import settings

logger = logging.getLogger(__name__)


class StorageService:
    def __init__(self):
        self._client = None
        self._bucket = settings.storage_bucket

    async def _ensure_client(self):
        if self._client is None:
            import boto3

            endpoint = getattr(settings, "storage_endpoint", "") or ""
            # Enforce TLS in production; honor explicit storage_use_ssl or https scheme
            configured_ssl = getattr(settings, "storage_use_ssl", None)
            if configured_ssl is not None:
                use_ssl = bool(configured_ssl)
            elif endpoint.startswith("https://"):
                use_ssl = True
            elif endpoint.startswith("http://"):
                use_ssl = False
            else:
                use_ssl = True

            self._client = boto3.client(
                "s3",
                endpoint_url=settings.storage_endpoint,
                region_name=settings.storage_region,
                aws_access_key_id=settings.storage_access_key,
                aws_secret_access_key=settings.storage_secret_key,
                use_ssl=use_ssl,
            )

    async def upload(self, key: str, data: bytes) -> str:
        await self._ensure_client()
        await asyncio.to_thread(self._client.put_object, Bucket=self._bucket, Key=key, Body=data)
        return key

    async def download(self, key: str) -> bytes:
        await self._ensure_client()

        def _do_download() -> bytes:
            result = self._client.get_object(Bucket=self._bucket, Key=key)
            return result["Body"].read()

        return await asyncio.to_thread(_do_download)

    async def delete(self, key: str) -> None:
        await self._ensure_client()
        await asyncio.to_thread(self._client.delete_object, Bucket=self._bucket, Key=key)

    async def list(self, prefix: str) -> list[str]:
        await self._ensure_client()

        def _do_list() -> list[str]:
            result = self._client.list_objects_v2(Bucket=self._bucket, Prefix=prefix)
            return [obj["Key"] for obj in result.get("Contents", [])]

        return await asyncio.to_thread(_do_list)

    async def get_signed_url(self, key: str, expires_in: int = 3600, operation: str = "get_object") -> str:
        await self._ensure_client()

        def _do_sign() -> str:
            if hasattr(self._client, "_client_config"):
                self._client._client_config.signature_version = "s3v4"
            return self._client.generate_presigned_url(
                operation,
                Params={"Bucket": self._bucket, "Key": key},
                ExpiresIn=expires_in,
            )

        return await asyncio.to_thread(_do_sign)

    async def get_upload_signed_url(self, key: str, expires_in: int = 900) -> str:
        return await self.get_signed_url(key=key, expires_in=expires_in, operation="put_object")


storage_service = StorageService()
