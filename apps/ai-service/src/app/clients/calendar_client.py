"""
Google Calendar API client. Handles OAuth2 token refresh, event listing, and creation.
Falls back to mock events when API is unavailable.
"""
import logging
from typing import Any, Dict, List, Optional

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.config import settings

logger = logging.getLogger(__name__)

OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token"
CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3"


class CalendarAuthError(Exception):
    pass


class CalendarClient:
    def __init__(
        self,
        client_id: str = "",
        client_secret: str = "",
        refresh_token: str = "",
        calendar_id: str = "",
    ):
        self.client_id = client_id or settings.google_client_id
        self.client_secret = client_secret or settings.google_client_secret
        self.refresh_token = refresh_token or settings.google_refresh_token
        self.calendar_id = calendar_id or settings.google_calendar_id
        self._access_token: Optional[str] = None
        self._configured = bool(self.client_id and self.client_secret and self.refresh_token)

    async def _refresh_access_token(self) -> str:
        if not self._configured:
            raise CalendarAuthError("Calendar API not configured")
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
                raise CalendarAuthError(f"Token refresh failed: {resp.status_code} {resp.text}")
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
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError, CalendarAuthError)),
    )
    async def _request(self, method: str, path: str, **kwargs) -> Dict[str, Any]:
        headers = await self._get_headers()
        if "headers" in kwargs:
            headers.update(kwargs.pop("headers"))
        url = f"{CALENDAR_API_BASE}{path}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.request(method, url, headers=headers, **kwargs)
            if resp.status_code == 401:
                self._access_token = None
                await self._refresh_access_token()
                headers["Authorization"] = f"Bearer {self._access_token}"
                resp = await client.request(method, url, headers=headers, **kwargs)
            if resp.status_code >= 400:
                logger.error(f"Calendar API error: {resp.status_code} {resp.text}")
                resp.raise_for_status()
            return resp.json()

    async def list_events(
        self,
        time_min: Optional[str] = None,
        time_max: Optional[str] = None,
        max_results: int = 50,
    ) -> Optional[List[Dict[str, Any]]]:
        if not self._configured:
            logger.info("Calendar API not configured — returning None for mock fallback")
            return None
        try:
            params: Dict[str, Any] = {
                "maxResults": min(max_results, 250),
                "orderBy": "startTime",
                "singleEvents": True,
            }
            if time_min:
                params["timeMin"] = time_min
            if time_max:
                params["timeMax"] = time_max

            data = await self._request("GET", f"/calendars/{self.calendar_id}/events", params=params)
            events = []
            for item in data.get("items", []):
                start = item.get("start", {})
                end = item.get("end", {})
                events.append({
                    "id": item.get("id", ""),
                    "title": item.get("summary", "Untitled"),
                    "start_time": start.get("dateTime", start.get("date", "")),
                    "end_time": end.get("dateTime", end.get("date", "")),
                    "source": "calendar",
                })
            return events
        except Exception as e:
            logger.warning(f"Calendar list failed: {e}")
            return None

    async def create_event(
        self,
        summary: str,
        start_time: str,
        end_time: str,
        description: str = "",
    ) -> Optional[Dict[str, Any]]:
        if not self._configured:
            logger.info("Calendar API not configured — cannot create event")
            return None
        try:
            body = {
                "summary": summary,
                "description": description,
                "start": {"dateTime": start_time, "timeZone": "UTC"},
                "end": {"dateTime": end_time, "timeZone": "UTC"},
            }
            result = await self._request("POST", f"/calendars/{self.calendar_id}/events", json=body)
            logger.info(f"Event created: {result.get('id', '?')}")
            return result
        except Exception as e:
            logger.warning(f"Failed to create event: {e}")
            return None

    async def check_health(self) -> bool:
        if not self._configured:
            return False
        try:
            await self._request("GET", f"/calendars/{self.calendar_id}")
            return True
        except Exception:
            return False
