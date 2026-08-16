import pytest
from unittest.mock import MagicMock, patch
from api.services.storage_service import StorageService


@pytest.fixture
def storage_service():
    svc = StorageService()
    svc._bucket = "test-bucket"
    mock_client = MagicMock()
    svc._client = mock_client
    return svc


@pytest.mark.asyncio
async def test_ensure_client_creates_when_none():
    import builtins
    fake_client = MagicMock()
    fake_boto3 = MagicMock()
    fake_boto3.client.return_value = fake_client
    original_import = builtins.__import__

    def mock_import(name, *args, **kwargs):
        if name == "boto3":
            return fake_boto3
        return original_import(name, *args, **kwargs)

    with patch.object(builtins, "__import__", side_effect=mock_import):
        svc = StorageService()
        svc._client = None
        svc._bucket = "test-bucket"
        await svc._ensure_client()
        assert svc._client is fake_client
        fake_boto3.client.assert_called_once()


@pytest.mark.asyncio
async def test_upload(storage_service):
    key = "test/file.txt"
    data = b"hello world"
    result = await storage_service.upload(key, data)
    storage_service._client.put_object.assert_called_once_with(
        Bucket="test-bucket", Key=key, Body=data
    )
    assert result == key


@pytest.mark.asyncio
async def test_download(storage_service):
    key = "test/file.txt"
    storage_service._client.get_object.return_value = {
        "Body": MagicMock(read=MagicMock(return_value=b"file content"))
    }
    result = await storage_service.download(key)
    storage_service._client.get_object.assert_called_once_with(
        Bucket="test-bucket", Key=key
    )
    assert result == b"file content"


@pytest.mark.asyncio
async def test_delete(storage_service):
    key = "test/file.txt"
    await storage_service.delete(key)
    storage_service._client.delete_object.assert_called_once_with(
        Bucket="test-bucket", Key=key
    )


@pytest.mark.asyncio
async def test_list(storage_service):
    storage_service._client.list_objects_v2.return_value = {
        "Contents": [
            {"Key": "dir/file1.txt"},
            {"Key": "dir/file2.txt"},
        ]
    }
    result = await storage_service.list("dir/")
    storage_service._client.list_objects_v2.assert_called_once_with(
        Bucket="test-bucket", Prefix="dir/"
    )
    assert result == ["dir/file1.txt", "dir/file2.txt"]


@pytest.mark.asyncio
async def test_list_empty(storage_service):
    storage_service._client.list_objects_v2.return_value = {}
    result = await storage_service.list("empty/")
    assert result == []


@pytest.mark.asyncio
async def test_get_signed_url(storage_service):
    storage_service._client._client_config = MagicMock()
    storage_service._client.generate_presigned_url.return_value = "https://signed-url.com/file"
    result = await storage_service.get_signed_url("test/file.txt", expires_in=3600)
    storage_service._client.generate_presigned_url.assert_called_once_with(
        "get_object",
        Params={"Bucket": "test-bucket", "Key": "test/file.txt"},
        ExpiresIn=3600,
    )
    assert result == "https://signed-url.com/file"
