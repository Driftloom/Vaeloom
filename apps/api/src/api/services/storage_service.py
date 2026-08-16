from botocore.config import Config

from ..config import settings


class StorageService:
    def __init__(self):
        self._client = None
        self._bucket = settings.storage_bucket

    async def _ensure_client(self):
        if self._client is None:
            import boto3

            self._client = boto3.client(
                "s3",
                endpoint_url=settings.storage_endpoint,
                region_name=settings.storage_region,
                aws_access_key_id=settings.storage_access_key,
                aws_secret_access_key=settings.storage_secret_key,
                use_ssl=False,
            )

    async def upload(self, key: str, data: bytes) -> str:
        await self._ensure_client()
        self._client.put_object(Bucket=self._bucket, Key=key, Body=data)
        return key

    async def download(self, key: str) -> bytes:
        await self._ensure_client()
        result = self._client.get_object(Bucket=self._bucket, Key=key)
        return result["Body"].read()

    async def delete(self, key: str) -> None:
        await self._ensure_client()
        self._client.delete_object(Bucket=self._bucket, Key=key)

    async def list(self, prefix: str) -> list[str]:
        await self._ensure_client()
        result = self._client.list_objects_v2(Bucket=self._bucket, Prefix=prefix)
        return [obj["Key"] for obj in result.get("Contents", [])]

    async def get_signed_url(self, key: str, expires_in: int = 3600) -> str:
        await self._ensure_client()
        self._client._client_config.signature_version = "s3v4"
        return self._client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self._bucket, "Key": key},
            ExpiresIn=expires_in,
        )


storage_service = StorageService()
