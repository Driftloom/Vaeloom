"""Gmail watch lifecycle + draft operations.

MVP rule: Gmail is draft-only. Watch state is persisted per workspace so push
notifications can be verified, renewed and reconciled without polling.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..clients.gmail_client import GmailClient
from ..models.schema import GmailWatch
from ..schemas.gmail import DraftCreateRequest, WatchStatusResponse

logger = logging.getLogger(__name__)

WATCH_RENEWAL_HOURS = 24


class GmailService:
    def __init__(self, client: GmailClient | None = None):
        self._client = client or GmailClient()

    def _client_for(self, client: GmailClient | None) -> GmailClient:
        return client or self._client

    @property
    def configured(self) -> bool:
        return bool(self._client._configured)

    async def start_watch(
        self, topic: str, workspace_id: str, user_id: str, db: AsyncSession,
        client: GmailClient | None = None,
    ) -> WatchStatusResponse:
        import secrets
        gmail = self._client_for(client)
        if not gmail._configured:
            return WatchStatusResponse(active=False, message="Gmail API not configured")

        result = await gmail.start_watch(topic)
        if not result:
            return WatchStatusResponse(active=False, message="Failed to start Gmail watch")

        now = datetime.now(timezone.utc)
        expiration = now + timedelta(days=7)
        history_id = str(result.get("historyId", "")) or None
        channel_token = secrets.token_urlsafe(32)

        existing = await db.execute(
            select(GmailWatch).where(GmailWatch.workspace_id == str(workspace_id))
        )
        watch = existing.scalar_one_or_none()
        if watch:
            watch.channel_id = result["id"]
            watch.channel_token = channel_token
            watch.resource_id = result.get("resourceId")
            watch.history_id = history_id
            watch.expiration = expiration
            watch.status = "ACTIVE"
            watch.user_id = str(user_id)
            watch.topic = topic
        else:
            watch = GmailWatch(
                workspace_id=str(workspace_id),
                user_id=str(user_id),
                topic=topic,
                channel_id=result["id"],
                channel_token=channel_token,
                resource_id=result.get("resourceId"),
                history_id=history_id,
                expiration=expiration,
                status="ACTIVE",
            )
            db.add(watch)
        await db.commit()
        await db.refresh(watch)
        logger.info("Gmail watch started for workspace %s (channel %s)", workspace_id, result["id"])
        return WatchStatusResponse(
            active=True,
            workspace_id=workspace_id,
            channel_id=watch.channel_id,
            resource_id=watch.resource_id,
            history_id=watch.history_id,
            expiration=expiration,
            status="ACTIVE",
        )

    async def get_watch_status(
        self, workspace_id: str, db: AsyncSession, client: GmailClient | None = None,
    ) -> WatchStatusResponse:
        gmail = self._client_for(client)
        if not gmail._configured:
            return WatchStatusResponse(active=False, message="Gmail API not configured")

        existing = await db.execute(
            select(GmailWatch).where(GmailWatch.workspace_id == str(workspace_id))
        )
        watch = existing.scalar_one_or_none()
        if not watch or watch.status != "ACTIVE":
            return WatchStatusResponse(active=False, status=watch.status if watch else None)

        if watch.expiration:
            expiration = watch.expiration
            if expiration.tzinfo is None:
                expiration = expiration.replace(tzinfo=timezone.utc)
            if expiration < datetime.now(timezone.utc) + timedelta(hours=WATCH_RENEWAL_HOURS):
                await self.renew_watch(workspace_id, db, client=client)
                await db.refresh(watch)
        return WatchStatusResponse(
            active=True,
            workspace_id=workspace_id,
            channel_id=watch.channel_id,
            resource_id=watch.resource_id,
            history_id=watch.history_id,
            expiration=watch.expiration,
            status="ACTIVE",
        )

    async def renew_watch(
        self, workspace_id: str, db: AsyncSession, client: GmailClient | None = None,
    ) -> WatchStatusResponse:
        gmail = self._client_for(client)
        existing = await db.execute(
            select(GmailWatch).where(GmailWatch.workspace_id == str(workspace_id))
        )
        watch = existing.scalar_one_or_none()
        if not watch:
            return WatchStatusResponse(active=False, message="No watch registered")

        result = await gmail.start_watch(watch.topic)
        if not result:
            watch.status = "EXPIRED"
            await db.commit()
            return WatchStatusResponse(active=False, status="EXPIRED", message="Renewal failed")
        watch.channel_id = result["id"]
        watch.resource_id = result.get("resourceId")
        if result.get("historyId"):
            watch.history_id = str(result["historyId"])
        watch.expiration = datetime.now(timezone.utc) + timedelta(days=7)
        watch.status = "ACTIVE"
        await db.commit()
        await db.refresh(watch)
        return WatchStatusResponse(
            active=True,
            workspace_id=workspace_id,
            channel_id=watch.channel_id,
            history_id=watch.history_id,
            expiration=watch.expiration,
            status="ACTIVE",
        )

    async def stop_watch(
        self, workspace_id: str, db: AsyncSession, client: GmailClient | None = None,
    ) -> bool:
        gmail = self._client_for(client)
        existing = await db.execute(
            select(GmailWatch).where(GmailWatch.workspace_id == str(workspace_id))
        )
        watch = existing.scalar_one_or_none()
        if not watch:
            return True
        if gmail._configured and watch.status == "ACTIVE":
            await gmail.stop_watch(watch.channel_id, watch.resource_id)
        watch.status = "STOPPED"
        await db.commit()
        return True

    async def handle_push(
        self, channel_id: str, history_id: int | None, db: AsyncSession,
    ) -> bool:
        existing = await db.execute(
            select(GmailWatch).where(GmailWatch.channel_id == channel_id)
        )
        watch = existing.scalar_one_or_none()
        if not watch or watch.status != "ACTIVE":
            logger.warning("Push notification for unknown/inactive channel %s", channel_id)
            return False
        if history_id is not None:
            watch.history_id = str(history_id)
        watch.last_reconciled_at = datetime.now(timezone.utc)
        await db.commit()
        logger.info(
            "Push notification accepted for workspace %s (history=%s)",
            watch.workspace_id, history_id,
        )
        return True

    async def create_draft(
        self, draft: DraftCreateRequest, db: AsyncSession,
        client: GmailClient | None = None,
    ) -> dict[str, Any] | None:
        gmail = self._client_for(client)
        if not gmail._configured:
            return None
        return await gmail.create_draft(to=draft.to, subject=draft.subject, body=draft.body)

    async def list_drafts(
        self, db: AsyncSession, max_results: int = 20, client: GmailClient | None = None,
    ) -> list[dict[str, Any]]:
        gmail = self._client_for(client)
        if not gmail._configured:
            return []
        drafts = await gmail.list_drafts(max_results=max_results)
        return drafts or []


gmail_service = GmailService()
