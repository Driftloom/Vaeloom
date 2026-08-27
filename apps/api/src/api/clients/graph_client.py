"""
Microsoft Graph API client — OAuth2 refresh-token flow, mirrors Gmail/Calendar/Drive clients.

Handles Outlook mail, Graph Calendar, and OneDrive via a single refresh token.
Scopes are granted at consent time; this client uses the refresh_token to obtain
an access_token for https://graph.microsoft.com.

 Falls back gracefully (returns None) when not configured so executor can mock.
"""
import logging
from typing import Any

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from api.config import settings

logger = logging.getLogger(__name__)

OAUTH_TOKEN_URL_TMPL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
GRAPH_API_BASE = "https://graph.microsoft.com/v1.0"


class GraphAuthError(Exception):
    pass


class GraphAPIError(Exception):
    pass


class GraphClient:
    """Single client for Outlook, Calendar, OneDrive — shares token + config."""

    def __init__(
        self,
        client_id: str = "",
        client_secret: str = "",
        refresh_token: str = "",
        tenant_id: str = "",
    ):
        self.client_id = client_id or settings.ms_graph_client_id
        self.client_secret = client_secret or settings.ms_graph_client_secret
        self.refresh_token = refresh_token or settings.ms_graph_refresh_token
        self.tenant_id = tenant_id or settings.ms_graph_tenant_id or "common"
        self._access_token: str | None = None
        self._configured = bool(self.client_id and self.client_secret and self.refresh_token)

    async def _refresh_access_token(self) -> str:
        if not self._configured:
            raise GraphAuthError("Microsoft Graph not configured")
        url = OAUTH_TOKEN_URL_TMPL.format(tenant=self.tenant_id)
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                url,
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "refresh_token": self.refresh_token,
                    "grant_type": "refresh_token",
                    "scope": "https://graph.microsoft.com/.default offline_access",
                },
            )
            if resp.status_code != 200:
                raise GraphAuthError(f"Graph token refresh failed: {resp.status_code} {resp.text[:500]}")
            data = resp.json()
            self._access_token = data["access_token"]
            # refresh_token may rotate
            if data.get("refresh_token"):
                self.refresh_token = data["refresh_token"]
            return self._access_token

    async def _get_headers(self) -> dict[str, str]:
        if not self._access_token:
            await self._refresh_access_token()
        return {"Authorization": f"Bearer {self._access_token}", "Content-Type": "application/json"}

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError, GraphAuthError)),
    )
    async def _request(self, method: str, path: str, **kwargs) -> Any:
        headers = await self._get_headers()
        if "headers" in kwargs:
            headers.update(kwargs.pop("headers"))
        url = f"{GRAPH_API_BASE}{path}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.request(method, url, headers=headers, **kwargs)
            if resp.status_code == 401:
                self._access_token = None
                await self._refresh_access_token()
                headers["Authorization"] = f"Bearer {self._access_token}"
                resp = await client.request(method, url, headers=headers, **kwargs)
            if resp.status_code >= 400:
                logger.error(f"Graph API error {resp.status_code} {path}: {resp.text[:500]}")
                resp.raise_for_status()
            # 204 no content
            if resp.status_code == 204:
                return None
            try:
                return resp.json()
            except Exception:
                return resp.content

    # ── Outlook Mail ──────────────────────────────────────────────────

    async def search_mail(self, query: str = "", max_results: int = 20) -> list[dict[str, Any]] | None:
        if not self._configured:
            logger.info("Graph not configured — search_mail mock fallback")
            return None
        try:
            params: dict[str, Any] = {"$top": min(max_results, 50), "$orderby": "receivedDateTime desc"}
            if query:
                params["$search"] = f'"{query}"'
                # $search requires ConsistencyLevel
                headers = {"ConsistencyLevel": "eventual"}
            else:
                headers = {}
            data = await self._request("GET", "/me/messages", params=params, headers=headers)
            items = data.get("value", []) if isinstance(data, dict) else []
            return [
                {
                    "id": m.get("id", ""),
                    "subject": m.get("subject", ""),
                    "sender": (m.get("from") or {}).get("emailAddress", {}).get("address", ""),
                    "body": (m.get("bodyPreview") or "")[:2000],
                    "receivedDateTime": m.get("receivedDateTime", ""),
                }
                for m in items
            ]
        except Exception as e:
            logger.warning(f"Graph search_mail failed: {e}")
            return None

    async def create_draft(self, to: str, subject: str, body: str) -> dict[str, Any] | None:
        if not self._configured:
            logger.info("Graph not configured — create_draft mock fallback")
            return None
        try:
            payload = {
                "subject": subject,
                "body": {"contentType": "Text", "content": body},
                "toRecipients": [{"emailAddress": {"address": to}}],
            }
            data = await self._request("POST", "/me/messages", json=payload)
            # draft is already created as message; move to drafts is implicit via isDraft
            return data if isinstance(data, dict) else {"id": "unknown"}
        except Exception as e:
            logger.warning(f"Graph create_draft failed: {e}")
            return None

    # ── Calendar ──────────────────────────────────────────────────────

    async def list_events(
        self, time_min: str | None = None, time_max: str | None = None, max_results: int = 50
    ) -> list[dict[str, Any]] | None:
        if not self._configured:
            logger.info("Graph not configured — list_events mock fallback")
            return None
        try:
            params: dict[str, Any] = {"$top": min(max_results, 100), "$orderby": "start/dateTime"}
            if time_min or time_max:
                filters = []
                if time_min:
                    filters.append(f"start/dateTime ge '{time_min}'")
                if time_max:
                    filters.append(f"end/dateTime le '{time_max}'")
                if filters:
                    params["$filter"] = " and ".join(filters)
            data = await self._request("GET", "/me/calendar/events", params=params)
            items = data.get("value", []) if isinstance(data, dict) else []
            return [
                {
                    "id": e.get("id", ""),
                    "title": e.get("subject", "Untitled"),
                    "start_time": (e.get("start") or {}).get("dateTime", ""),
                    "end_time": (e.get("end") or {}).get("dateTime", ""),
                    "source": "outlook_calendar",
                }
                for e in items
            ]
        except Exception as e:
            logger.warning(f"Graph list_events failed: {e}")
            return None

    async def create_event(
        self, summary: str, start_time: str, end_time: str, description: str = ""
    ) -> dict[str, Any] | None:
        if not self._configured:
            logger.info("Graph not configured — create_event mock fallback")
            return None
        try:
            payload = {
                "subject": summary,
                "body": {"contentType": "Text", "content": description},
                "start": {"dateTime": start_time, "timeZone": "UTC"},
                "end": {"dateTime": end_time, "timeZone": "UTC"},
            }
            data = await self._request("POST", "/me/calendar/events", json=payload)
            return data if isinstance(data, dict) else {"id": "unknown"}
        except Exception as e:
            logger.warning(f"Graph create_event failed: {e}")
            return None

    # ── OneDrive ──────────────────────────────────────────────────────

    async def list_files(self, page_size: int = 50, query: str | None = None) -> list[dict[str, Any]] | None:
        if not self._configured:
            logger.info("Graph not configured — list_files mock fallback")
            return None
        try:
            params: dict[str, Any] = {"$top": min(page_size, 100)}
            # drive root children
            if query and query.strip().lower() not in ("trashed = false", ""):
                # OneDrive search
                return await self.search_files(query, page_size=page_size)
            data = await self._request("GET", "/me/drive/root/children", params=params)
            items = data.get("value", []) if isinstance(data, dict) else []
            return [self._normalize_drive_item(i) for i in items]
        except Exception as e:
            logger.warning(f"Graph list_files failed: {e}")
            return None

    async def search_files(self, query: str, page_size: int = 50) -> list[dict[str, Any]] | None:
        if not self._configured:
            logger.info("Graph not configured — search_files mock fallback")
            return None
        try:
            data = await self._request("GET", f"/me/drive/root/search(q='{query}')", params={"$top": min(page_size, 50)})
            items = data.get("value", []) if isinstance(data, dict) else []
            return [self._normalize_drive_item(i) for i in items]
        except Exception as e:
            logger.warning(f"Graph search_files failed: {e}")
            return None

    async def download_file(self, file_id: str) -> bytes | None:
        if not self._configured:
            return None
        try:
            # /me/drive/items/{id}/content returns binary
            headers = await self._get_headers()
            url = f"{GRAPH_API_BASE}/me/drive/items/{file_id}/content"
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 401:
                    self._access_token = None
                    headers = await self._get_headers()
                    resp = await client.get(url, headers=headers)
                if resp.status_code >= 400:
                    logger.error(f"Graph download failed {resp.status_code}: {resp.text[:500]}")
                    return None
                return resp.content
        except Exception as e:
            logger.warning(f"Graph download_file failed: {e}")
            return None

    async def get_file(self, file_id: str) -> dict[str, Any] | None:
        if not self._configured:
            return None
        try:
            data = await self._request("GET", f"/me/drive/items/{file_id}")
            return self._normalize_drive_item(data) if isinstance(data, dict) else None
        except Exception as e:
            logger.warning(f"Graph get_file failed: {e}")
            return None

    def _normalize_drive_item(self, raw: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": raw.get("id", ""),
            "name": raw.get("name", ""),
            "mimeType": (raw.get("file") or {}).get("mimeType", "application/octet-stream"),
            "size": str(raw.get("size", 0)),
            "modifiedTime": raw.get("lastModifiedDateTime", ""),
            "webViewLink": raw.get("webViewUrl", ""),
        }

    async def check_health(self) -> bool:
        if not self._configured:
            return False
        try:
            await self._request("GET", "/me")
            return True
        except Exception:
            return False
