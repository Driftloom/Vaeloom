"""
Google Docs API v1 client. Handles OAuth2 token refresh, document creation,
structured text extraction, appending, and template placeholder replacement.
Falls back gracefully when API is unconfigured or unavailable.
"""
import logging
from typing import Any

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from api.config import settings

logger = logging.getLogger(__name__)

OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token"
DOCS_API_BASE = "https://docs.googleapis.com/v1"


class DocsAuthError(Exception):
    pass


class DocsAPIError(Exception):
    pass


class DocsClient:
    def __init__(
        self,
        client_id: str = "",
        client_secret: str = "",
        refresh_token: str = "",
        workspace_id: str | None = None,
    ):
        self.workspace_id = workspace_id
        self.client_id = client_id or settings.google_client_id
        self.client_secret = client_secret or settings.google_client_secret
        self.refresh_token = refresh_token or settings.google_refresh_token
        self._access_token: str | None = None
        self._configured = bool(self.client_id and self.client_secret and self.refresh_token)

    @classmethod
    async def for_workspace(cls, workspace_id: str | None = None) -> "DocsClient":
        """Load DocsClient configured for a specific workspace.
        First checks the database `connectors` table for encrypted Google Docs/Drive tokens.
        Falls back to settings.google_refresh_token if not found.
        """
        if not workspace_id:
            return cls()
        try:
            import uuid
            from sqlalchemy import select
            from api.database import async_session_factory
            from api.models.schema import Connector
            from api.services.encryption import decrypt_value

            async with async_session_factory() as db:
                result = await db.execute(
                    select(Connector).where(
                        Connector.workspace_id == uuid.UUID(str(workspace_id)),
                        Connector.type.in_([
                            "docs", "google_docs", "google-docs",
                            "drive", "google_drive", "google-drive"
                        ]),
                    ).limit(1)
                )
                conn = result.scalar_one_or_none()
                if conn and conn.token_ref:
                    token = decrypt_value(conn.token_ref)
                    if token:
                        return cls(refresh_token=token, workspace_id=workspace_id)
        except Exception as e:
            logger.debug(f"Could not load workspace docs connector: {e}")
        return cls(workspace_id=workspace_id)

    async def _refresh_access_token(self) -> str:
        if not self._configured:
            raise DocsAuthError("Google Docs API not configured")
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
                raise DocsAuthError(f"Token refresh failed: {resp.status_code} {resp.text}")
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
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError, DocsAuthError)),
    )
    async def _request(self, method: str, path: str, **kwargs) -> dict[str, Any]:
        headers = await self._get_headers()
        if "headers" in kwargs:
            headers.update(kwargs.pop("headers"))
        url = f"{DOCS_API_BASE}{path}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.request(method, url, headers=headers, **kwargs)
            if resp.status_code == 401:
                self._access_token = None
                await self._refresh_access_token()
                headers["Authorization"] = f"Bearer {self._access_token}"
                resp = await client.request(method, url, headers=headers, **kwargs)
            if resp.status_code >= 400:
                logger.error(f"Docs API error: {resp.status_code} {resp.text}")
                raise DocsAPIError(f"Docs API error: {resp.status_code} {resp.text}")
            return resp.json()

    async def create_document(self, title: str) -> dict[str, Any] | None:
        """Create a new Google Document."""
        if not self._configured:
            logger.info("Docs API not configured — returning mock document response")
            return None
        try:
            return await self._request("POST", "/documents", json={"title": title})
        except Exception as e:
            logger.warning(f"Docs create_document failed: {e}")
            return None

    async def get_document(self, document_id: str) -> dict[str, Any] | None:
        """Fetch complete document metadata and AST."""
        if not self._configured:
            logger.info("Docs API not configured — cannot get document")
            return None
        try:
            return await self._request("GET", f"/documents/{document_id}")
        except Exception as e:
            logger.warning(f"Docs get_document failed: {e}")
            return None

    async def read_document_text(self, document_id: str) -> str | None:
        """Extract clean, structured markdown/plain text from a Google Document."""
        doc = await self.get_document(document_id)
        if not doc:
            return None

        lines: list[str] = []
        title = doc.get("title")
        if title:
            lines.append(f"# {title}\n")

        body = doc.get("body", {})
        content = body.get("content", [])

        for element in content:
            paragraph = element.get("paragraph")
            if paragraph:
                para_style = paragraph.get("paragraphStyle", {}).get("namedStyleType", "NORMAL_TEXT")
                prefix = ""
                if para_style == "TITLE":
                    prefix = "# "
                elif para_style == "HEADING_1":
                    prefix = "## "
                elif para_style == "HEADING_2":
                    prefix = "### "
                elif para_style == "HEADING_3":
                    prefix = "#### "

                if "bullet" in paragraph:
                    prefix = "- "

                para_text = ""
                for part in paragraph.get("elements", []):
                    text_run = part.get("textRun")
                    if text_run and "content" in text_run:
                        para_text += text_run["content"]

                if para_text.strip():
                    lines.append(f"{prefix}{para_text.strip()}")
                elif para_text == "\n":
                    lines.append("")

            table = element.get("table")
            if table:
                for row in table.get("tableRows", []):
                    row_cells = []
                    for cell in row.get("tableCells", []):
                        cell_text = ""
                        for cell_elem in cell.get("content", []):
                            cell_para = cell_elem.get("paragraph")
                            if cell_para:
                                for part in cell_para.get("elements", []):
                                    text_run = part.get("textRun")
                                    if text_run and "content" in text_run:
                                        cell_text += text_run["content"].strip()
                        row_cells.append(cell_text)
                    lines.append("| " + " | ".join(row_cells) + " |")

        return "\n".join(lines)

    async def batch_update(
        self, document_id: str, requests: list[dict[str, Any]]
    ) -> dict[str, Any] | None:
        """Execute atomic batchUpdate mutations on a Google Document."""
        if not self._configured:
            logger.info("Docs API not configured — cannot batch_update")
            return None
        try:
            return await self._request(
                "POST", f"/documents/{document_id}:batchUpdate", json={"requests": requests}
            )
        except Exception as e:
            logger.warning(f"Docs batch_update failed: {e}")
            return None

    async def append_text(self, document_id: str, text: str) -> dict[str, Any] | None:
        """Append text to the end of a Google Document."""
        doc = await self.get_document(document_id)
        if not doc:
            return None
        try:
            body = doc.get("body", {})
            content = body.get("content", [])
            # In Google Docs, endIndex of the last element is the insertion point before the terminating newline
            end_index = 1
            if content:
                end_index = max(1, content[-1].get("endIndex", 2) - 1)

            req = {
                "insertText": {
                    "location": {"index": end_index},
                    "text": ("\n" if end_index > 1 else "") + text,
                }
            }
            return await self.batch_update(document_id, [req])
        except Exception as e:
            logger.warning(f"Docs append_text failed: {e}")
            return None

    async def replace_text(
        self, document_id: str, find_text: str, replace_text: str, match_case: bool = True
    ) -> dict[str, Any] | None:
        """Replace all occurrences of a placeholder string (e.g. {{candidate_name}}) in the document."""
        req = {
            "replaceAllText": {
                "containsText": {"text": find_text, "matchCase": match_case},
                "replaceText": replace_text,
            }
        }
        return await self.batch_update(document_id, [req])

    async def check_health(self) -> bool:
        if not self._configured:
            return False
        try:
            await self._refresh_access_token()
            return True
        except Exception:
            return False
