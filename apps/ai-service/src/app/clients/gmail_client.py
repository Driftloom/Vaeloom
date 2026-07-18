"""
Gmail API client. Handles OAuth2 token refresh, email fetching, and draft creation.
Falls back to mock emails when API is unavailable.
"""
import base64
import email
import logging
from typing import Any, Dict, List, Optional

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.config import settings

logger = logging.getLogger(__name__)

OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token"
GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"


class GmailAuthError(Exception):
    pass


class GmailClient:
    def __init__(
        self,
        client_id: str = "",
        client_secret: str = "",
        refresh_token: str = "",
    ):
        self.client_id = client_id or settings.google_client_id
        self.client_secret = client_secret or settings.google_client_secret
        self.refresh_token = refresh_token or settings.google_refresh_token
        self._access_token: Optional[str] = None
        self._configured = bool(self.client_id and self.client_secret and self.refresh_token)

    async def _refresh_access_token(self) -> str:
        if not self._configured:
            raise GmailAuthError("Gmail API not configured")
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
                raise GmailAuthError(f"Token refresh failed: {resp.status_code} {resp.text}")
            data = resp.json()
            self._access_token = data["access_token"]
            return self._access_token

    async def _get_headers(self) -> Dict[str, str]:
        if not self._access_token:
            await self._refresh_access_token()
        return {"Authorization": f"Bearer {self._access_token}", "Content-Type": "application/json"}

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError, GmailAuthError)),
    )
    async def _request(self, method: str, path: str, **kwargs) -> Dict[str, Any]:
        headers = await self._get_headers()
        if "headers" in kwargs:
            headers.update(kwargs.pop("headers"))
        url = f"{GMAIL_API_BASE}{path}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.request(method, url, headers=headers, **kwargs)
            if resp.status_code == 401:
                self._access_token = None
                await self._refresh_access_token()
                headers["Authorization"] = f"Bearer {self._access_token}"
                resp = await client.request(method, url, headers=headers, **kwargs)
            if resp.status_code >= 400:
                logger.error(f"Gmail API error: {resp.status_code} {resp.text}")
                resp.raise_for_status()
            return resp.json()

    async def fetch_emails(
        self, max_results: int = 20, query: Optional[str] = None
    ) -> Optional[List[Dict[str, Any]]]:
        if not self._configured:
            logger.info("Gmail API not configured — returning None for mock fallback")
            return None
        try:
            params: Dict[str, Any] = {"maxResults": min(max_results, 50), "userId": "me"}
            if query:
                params["q"] = query
            list_data = await self._request("GET", "/messages", params=params)
            messages = []
            for msg_summary in list_data.get("messages", []):
                msg_data = await self._request(
                    "GET", f"/messages/{msg_summary['id']}", params={"format": "metadata"}
                )
                parsed = self._parse_message(msg_data)
                if parsed:
                    messages.append(parsed)
            return messages
        except Exception as e:
            logger.warning(f"Gmail fetch failed: {e}")
            return None

    def _parse_message(self, raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        try:
            msg_id = raw.get("id", "unknown")
            headers_dict: Dict[str, str] = {}
            for h in raw.get("payload", {}).get("headers", []):
                headers_dict[h["name"].lower()] = h["value"]

            subject = headers_dict.get("subject", "")
            sender = headers_dict.get("from", headers_dict.get("sender", ""))
            body = raw.get("snippet", "")

            return {
                "id": msg_id,
                "subject": subject,
                "sender": sender,
                "body": body,
            }
        except Exception as e:
            logger.warning(f"Failed to parse email {raw.get('id', '?')}: {e}")
            return None

    async def create_draft(self, to: str, subject: str, body: str) -> Optional[Dict[str, Any]]:
        if not self._configured:
            logger.info("Gmail API not configured — cannot create draft")
            return None
        try:
            mime_message = email.message.EmailMessage()
            mime_message.set_content(body)
            mime_message["To"] = to
            mime_message["Subject"] = subject

            encoded = base64.urlsafe_b64encode(mime_message.as_bytes()).decode("utf-8")
            draft_data = await self._request("POST", "/drafts", json={"message": {"raw": encoded}})
            logger.info(f"Draft created for {to}: {draft_data.get('id', '?')}")
            return draft_data
        except Exception as e:
            logger.warning(f"Failed to create draft: {e}")
            return None

    async def check_health(self) -> bool:
        if not self._configured:
            return False
        try:
            await self._request("GET", "/profile")
            return True
        except Exception:
            return False
