"""
Google Drive API v3 client. Handles OAuth2 token refresh, file listing, download,
search, metadata retrieval, and Google Workspace file export.
Falls back gracefully when API is unavailable.
"""
import logging
from typing import Any

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from api.config import settings

logger = logging.getLogger(__name__)

OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token"
DRIVE_API_BASE = "https://www.googleapis.com/drive/v3"


class DriveAuthError(Exception):
    pass


class DriveAPIError(Exception):
    pass


class DriveClient:
    def __init__(
        self,
        client_id: str = "",
        client_secret: str = "",
        refresh_token: str = "",
    ):
        self.client_id = client_id or settings.google_client_id
        self.client_secret = client_secret or settings.google_client_secret
        self.refresh_token = refresh_token or settings.google_refresh_token
        self._access_token: str | None = None
        self._configured = bool(self.client_id and self.client_secret and self.refresh_token)

    async def _refresh_access_token(self) -> str:
        if not self._configured:
            raise DriveAuthError("Drive API not configured")
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                OAUTH_TOKEN_URL,
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "refresh_token": self.refresh_token,
                    "grant_type": "refresh_token",
                },
            )
            if resp.status_code != 200:
                raise DriveAuthError(f"Token refresh failed: {resp.status_code} {resp.text}")
            data = resp.json()
            self._access_token = data["access_token"]
            return self._access_token

    async def _get_headers(self) -> dict[str, str]:
        if not self._access_token:
            await self._refresh_access_token()
        return {"Authorization": f"Bearer {self._access_token}", "Content-Type": "application/json"}

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError, DriveAuthError)),
    )
    async def _request(self, method: str, path: str, **kwargs) -> dict[str, Any]:
        headers = await self._get_headers()
        if "headers" in kwargs:
            headers.update(kwargs.pop("headers"))
        url = f"{DRIVE_API_BASE}{path}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.request(method, url, headers=headers, **kwargs)
            if resp.status_code == 401:
                self._access_token = None
                await self._refresh_access_token()
                headers["Authorization"] = f"Bearer {self._access_token}"
                resp = await client.request(method, url, headers=headers, **kwargs)
            if resp.status_code >= 400:
                logger.error(f"Drive API error: {resp.status_code} {resp.text}")
                raise DriveAPIError(f"Drive API error: {resp.status_code} {resp.text}")
            return resp.json()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError, DriveAuthError)),
    )
    async def _request_binary(self, method: str, path: str, **kwargs) -> bytes:
        headers = await self._get_headers()
        if "headers" in kwargs:
            headers.update(kwargs.pop("headers"))
        url = f"{DRIVE_API_BASE}{path}"
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.request(method, url, headers=headers, **kwargs)
            if resp.status_code == 401:
                self._access_token = None
                await self._refresh_access_token()
                headers["Authorization"] = f"Bearer {self._access_token}"
                resp = await client.request(method, url, headers=headers, **kwargs)
            if resp.status_code >= 400:
                logger.error(f"Drive API error: {resp.status_code} {resp.text}")
                raise DriveAPIError(f"Drive API error: {resp.status_code} {resp.text}")
            return resp.content

    async def list_files(
        self, page_size: int = 100, query: str = "trashed = false"
    ) -> list[dict[str, Any]] | None:
        if not self._configured:
            logger.info("Drive API not configured — returning None for mock fallback")
            return None
        try:
            fields = "files(id,name,mimeType,modifiedTime,size)"
            data = await self._request(
                "GET",
                "/files",
                params={"q": query, "fields": fields, "pageSize": min(page_size, 1000)},
            )
            return data.get("files", [])
        except Exception as e:
            logger.warning(f"Drive list_files failed: {e}")
            return None

    async def download_file(self, file_id: str) -> bytes | None:
        if not self._configured:
            logger.info("Drive API not configured — cannot download file")
            return None
        try:
            return await self._request_binary("GET", f"/files/{file_id}?alt=media")
        except Exception as e:
            logger.warning(f"Drive download_file failed: {e}")
            return None

    async def search_files(self, query: str, page_size: int = 100) -> list[dict[str, Any]] | None:
        if not self._configured:
            logger.info("Drive API not configured — returning None for mock fallback")
            return None
        try:
            fields = "files(id,name,mimeType,modifiedTime,size)"
            q = f"fullText contains '{query}' and trashed = false"
            data = await self._request(
                "GET",
                "/files",
                params={"q": q, "fields": fields, "pageSize": min(page_size, 1000)},
            )
            return data.get("files", [])
        except Exception as e:
            logger.warning(f"Drive search_files failed: {e}")
            return None

    async def get_file(self, file_id: str) -> dict[str, Any] | None:
        if not self._configured:
            logger.info("Drive API not configured — cannot get file metadata")
            return None
        try:
            fields = "id,name,mimeType,modifiedTime,size,webViewLink"
            return await self._request("GET", f"/files/{file_id}", params={"fields": fields})
        except Exception as e:
            logger.warning(f"Drive get_file failed: {e}")
            return None

    async def export_file(self, file_id: str, mime_type: str = "application/pdf") -> bytes | None:
        if not self._configured:
            logger.info("Drive API not configured — cannot export file")
            return None
        try:
            return await self._request_binary("GET", f"/files/{file_id}/export", params={"mimeType": mime_type})
        except Exception as e:
            logger.warning(f"Drive export_file failed: {e}")
            return None

    async def check_health(self) -> bool:
        if not self._configured:
            return False
        try:
            await self._request("GET", "/about", params={"fields": "user"})
            return True
        except Exception:
            return False
