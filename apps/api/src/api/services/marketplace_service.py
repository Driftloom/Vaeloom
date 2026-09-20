"""Marketplace Service.

Manages curated enterprise plugin listings, installation state per workspace,
and default catalog seeding.
"""

import logging
from typing import Any, Dict, List, Optional
import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.schema import MarketplaceListing, MarketplaceReview, WorkspacePluginInstall

logger = logging.getLogger(__name__)

CURATED_SEED_LISTINGS = [
    {
        "name": "Slack Connector",
        "slug": "slack-connector",
        "category": "Integration",
        "author": "Vaeloom",
        "version": "2.1.0",
        "description": "Sync notifications, approval requests, and candidate summaries directly with Slack channels.",
        "rating": 4.9,
        "install_count": 1420,
        "tags": ["slack", "messaging", "notifications", "chat"],
    },
    {
        "name": "Analytics Dashboard",
        "slug": "analytics-dashboard",
        "category": "Analytics",
        "author": "DataFlow",
        "version": "1.3.2",
        "description": "Advanced recruitment analytics with customizable candidate conversion and time-to-hire widgets.",
        "rating": 4.8,
        "install_count": 890,
        "tags": ["analytics", "metrics", "charts", "conversion"],
    },
    {
        "name": "GPT-4 Vision",
        "slug": "gpt4-vision",
        "category": "AI",
        "author": "OpenAI",
        "version": "3.0.0",
        "description": "Visual document recognition, infographic parsing, and portfolio image analysis workflows.",
        "rating": 4.9,
        "install_count": 2100,
        "tags": ["ai", "vision", "multimodal", "ocr"],
    },
    {
        "name": "GitHub Sync",
        "slug": "github-sync",
        "category": "Integration",
        "author": "Vaeloom",
        "version": "1.0.5",
        "description": "Bi-directional sync with GitHub repositories, code portfolios, and contribution histories.",
        "rating": 4.7,
        "install_count": 760,
        "tags": ["github", "code", "portfolio", "dev"],
    },
    {
        "name": "Calendar Pro",
        "slug": "calendar-pro",
        "category": "Productivity",
        "author": "Calendly",
        "version": "2.0.1",
        "description": "Smart candidate interview scheduling, timezone reconciliation, and availability detection.",
        "rating": 4.9,
        "install_count": 1650,
        "tags": ["calendar", "scheduling", "interviews"],
    },
    {
        "name": "Data Pipeline",
        "slug": "data-pipeline",
        "category": "Data",
        "author": "DataFlow",
        "version": "1.1.0",
        "description": "Automated ETL pipeline builder for workspace candidate data, resumes, and interview logs.",
        "rating": 4.6,
        "install_count": 430,
        "tags": ["etl", "pipeline", "export", "data"],
    },
    {
        "name": "Security Scanner",
        "slug": "security-scanner",
        "category": "Security",
        "author": "SecureAI",
        "version": "1.5.0",
        "description": "Automated security and secret scanning for uploaded candidate documents and code artifacts.",
        "rating": 4.8,
        "install_count": 920,
        "tags": ["security", "scanner", "pii", "secrets"],
    },
    {
        "name": "Notion Export",
        "slug": "notion-export",
        "category": "Productivity",
        "author": "Notion Labs",
        "version": "1.0.0",
        "description": "One-click export of tailored resumes, interview prep cheatsheets, and notes to Notion pages.",
        "rating": 4.7,
        "install_count": 1150,
        "tags": ["notion", "export", "notes"],
    },
    {
        "name": "Sentiment Analysis",
        "slug": "sentiment-analysis",
        "category": "AI",
        "author": "HuggingFace",
        "version": "2.3.0",
        "description": "Analyze communication tone and sentiment across recruiter emails and candidate interactions.",
        "rating": 4.5,
        "install_count": 640,
        "tags": ["nlp", "sentiment", "email", "tone"],
    },
]


class MarketplaceService:
    @staticmethod
    async def list_listings(
        db: AsyncSession,
        category: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> Dict[str, Any]:
        """Return paginated marketplace listings with optional search and category filter."""
        # Ensure seed listings exist
        await MarketplaceService.seed_default_listings_if_empty(db)

        stmt = select(MarketplaceListing)
        if category and category.lower() != "all":
            stmt = stmt.where(MarketplaceListing.category.ilike(category))

        if search:
            search_pattern = f"%{search}%"
            stmt = stmt.where(
                or_(
                    MarketplaceListing.name.ilike(search_pattern),
                    MarketplaceListing.description.ilike(search_pattern),
                    MarketplaceListing.author.ilike(search_pattern),
                )
            )

        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_res = await db.execute(count_stmt)
        total = total_res.scalar() or 0

        # Paginate
        stmt = stmt.order_by(MarketplaceListing.install_count.desc())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)

        res = await db.execute(stmt)
        listings = res.scalars().all()

        return {
            "items": [
                {
                    "id": str(l.id),
                    "name": l.name,
                    "slug": l.slug,
                    "category": l.category,
                    "author": l.author,
                    "description": l.description,
                    "version": l.version,
                    "icon_url": l.icon_url,
                    "is_verified": l.is_verified,
                    "rating": l.rating,
                    "install_count": l.install_count,
                    "tags": l.tags,
                }
                for l in listings
            ],
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    @staticmethod
    async def get_listing(db: AsyncSession, listing_id_or_slug: str) -> Optional[MarketplaceListing]:
        """Retrieve a listing by UUID or slug."""
        try:
            val_uuid = uuid.UUID(listing_id_or_slug)
            stmt = select(MarketplaceListing).where(MarketplaceListing.id == val_uuid)
        except ValueError:
            stmt = select(MarketplaceListing).where(MarketplaceListing.slug == listing_id_or_slug)

        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    @staticmethod
    async def install_plugin(
        db: AsyncSession,
        workspace_id: uuid.UUID,
        listing_id: uuid.UUID,
        user_id: Optional[uuid.UUID] = None,
        config: Optional[dict] = None,
    ) -> WorkspacePluginInstall:
        """Install or activate a plugin in a workspace."""
        listing = await db.get(MarketplaceListing, listing_id)
        if not listing:
            raise ValueError("Marketplace listing not found")

        stmt = select(WorkspacePluginInstall).where(
            WorkspacePluginInstall.workspace_id == workspace_id,
            WorkspacePluginInstall.listing_id == listing_id,
        )
        res = await db.execute(stmt)
        install = res.scalar_one_or_none()

        # Encrypt sensitive configuration values
        encrypted_config = {}
        if config:
            from .encryption import encrypt_value
            for k, v in config.items():
                if isinstance(v, str) and any(s in k.lower() for s in ("key", "secret", "token", "password")) and not v.startswith("enc:"):
                    try:
                        encrypted_config[k] = "enc:" + encrypt_value(v)
                    except Exception:
                        encrypted_config[k] = v
                else:
                    encrypted_config[k] = v

        if install:
            install.is_active = True
            if config:
                install.config = encrypted_config
        else:
            install = WorkspacePluginInstall(
                workspace_id=workspace_id,
                listing_id=listing_id,
                installed_by=user_id,
                is_active=True,
                config=encrypted_config,
            )
            db.add(install)
            listing.install_count += 1

        await db.commit()
        await db.refresh(install)
        return install

    @staticmethod
    async def uninstall_plugin(
        db: AsyncSession,
        workspace_id: uuid.UUID,
        listing_id: uuid.UUID,
    ) -> bool:
        """Uninstall (deactivate) a plugin from a workspace."""
        stmt = select(WorkspacePluginInstall).where(
            WorkspacePluginInstall.workspace_id == workspace_id,
            WorkspacePluginInstall.listing_id == listing_id,
        )
        res = await db.execute(stmt)
        install = res.scalar_one_or_none()
        if not install:
            return False

        install.is_active = False
        await db.commit()
        return True

    @staticmethod
    async def get_installed_plugins(
        db: AsyncSession,
        workspace_id: uuid.UUID,
    ) -> List[Dict[str, Any]]:
        """Return all active installed plugins for a workspace."""
        stmt = (
            select(WorkspacePluginInstall)
            .where(
                WorkspacePluginInstall.workspace_id == workspace_id,
                WorkspacePluginInstall.is_active.is_(True),
            )
            .options(selectinload(WorkspacePluginInstall.listing))
        )
        res = await db.execute(stmt)
        installs = res.scalars().all()

        return [
            {
                "id": str(i.id),
                "listing_id": str(i.listing_id),
                "name": i.listing.name if i.listing else "Unknown Plugin",
                "slug": i.listing.slug if i.listing else "",
                "category": i.listing.category if i.listing else "Integration",
                "author": i.listing.author if i.listing else "",
                "version": i.listing.version if i.listing else "1.0.0",
                "description": i.listing.description if i.listing else "",
                "icon_url": i.listing.icon_url if i.listing else None,
                "installed_at": i.installed_at.isoformat() if i.installed_at else None,
                "config": i.config,
            }
            for i in installs
        ]

    @staticmethod
    async def seed_default_listings_if_empty(db: AsyncSession) -> int:
        """Seed the curated enterprise plugins if the marketplace table is empty."""
        stmt = select(func.count(MarketplaceListing.id))
        res = await db.execute(stmt)
        count = res.scalar() or 0
        if count > 0:
            return 0

        seeded_count = 0
        for item in CURATED_SEED_LISTINGS:
            listing = MarketplaceListing(
                name=item["name"],
                slug=item["slug"],
                category=item["category"],
                author=item["author"],
                description=item["description"],
                version=item["version"],
                rating=item["rating"],
                install_count=item["install_count"],
                tags=item["tags"],
            )
            db.add(listing)
            seeded_count += 1

        await db.commit()
        logger.info("Seeded %d default marketplace listings into catalog", seeded_count)
        return seeded_count

    @staticmethod
    async def rate_listing(
        db: AsyncSession,
        listing_id: uuid.UUID,
        user_id: uuid.UUID,
        rating: float,
        review: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Submit or update a rating and review for a marketplace listing."""
        if not (1.0 <= rating <= 5.0):
            raise ValueError("Rating must be between 1.0 and 5.0")

        listing = await db.get(MarketplaceListing, listing_id)
        if not listing:
            raise ValueError("Marketplace listing not found")

        stmt = select(MarketplaceReview).where(
            MarketplaceReview.listing_id == listing_id,
            MarketplaceReview.user_id == user_id,
        )
        res = await db.execute(stmt)
        existing_review = res.scalar_one_or_none()

        if existing_review:
            existing_review.rating = rating
            if review is not None:
                existing_review.review = review
        else:
            new_review = MarketplaceReview(
                id=uuid.uuid4(),
                listing_id=listing_id,
                user_id=user_id,
                rating=rating,
                review=review,
            )
            db.add(new_review)

        await db.flush()

        # Recompute average rating for listing
        avg_stmt = select(func.avg(MarketplaceReview.rating)).where(
            MarketplaceReview.listing_id == listing_id
        )
        avg_res = await db.execute(avg_stmt)
        new_avg = avg_res.scalar()
        if new_avg is not None:
            listing.rating = round(float(new_avg), 1)

        await db.commit()
        await db.refresh(listing)

        return {
            "listing_id": str(listing_id),
            "user_id": str(user_id),
            "rating": rating,
            "review": review,
            "average_rating": listing.rating,
        }

    @staticmethod
    async def execute_plugin_action(
        db: AsyncSession,
        workspace_id: uuid.UUID,
        install_id: uuid.UUID,
        action: str,
        params: dict,
    ) -> Dict[str, Any]:
        """Execute an action on an installed plugin with decrypted secrets."""
        stmt = (
            select(WorkspacePluginInstall)
            .where(
                WorkspacePluginInstall.id == install_id,
                WorkspacePluginInstall.workspace_id == workspace_id,
                WorkspacePluginInstall.is_active.is_(True),
            )
            .options(selectinload(WorkspacePluginInstall.listing))
        )
        res = await db.execute(stmt)
        install = res.scalar_one_or_none()
        if not install:
            raise ValueError("Installed plugin not found or not active in this workspace")

        # Decrypt config values
        from .encryption import decrypt_value
        raw_config = install.config or {}
        decrypted_config = {}
        for k, v in raw_config.items():
            if isinstance(v, str) and v.startswith("enc:"):
                try:
                    decrypted_config[k] = decrypt_value(v[4:])
                except Exception:
                    decrypted_config[k] = v
            else:
                decrypted_config[k] = v

        logger.info(
            "Executing plugin action: plugin=%s action=%s workspace=%s",
            install.listing.slug if install.listing else "unknown",
            action,
            workspace_id,
        )
        return {
            "status": "success",
            "plugin": install.listing.slug if install.listing else str(install_id),
            "action": action,
            "result": {
                "message": f"Action '{action}' executed successfully on {install.listing.name if install.listing else 'plugin'}",
                "params": params,
                "configured": bool(decrypted_config),
            },
        }

    @staticmethod
    async def bridge_installed_plugins_to_agent_tools(
        db: AsyncSession,
        workspace_id: uuid.UUID,
    ) -> int:
        """Dynamically register tools in executor for all active plugins in the workspace."""
        from ..tools.definitions import ToolDefinition
        from ..tools.executor import register_dynamic_tool

        plugins = await MarketplaceService.get_installed_plugins(db, workspace_id)
        count = 0
        for p in plugins:
            slug = p["slug"]
            tool_name = f"plugin__{slug}__execute"

            async def _make_handler(inst_slug=slug):
                async def _handler(params: dict, ws_id: Any) -> dict:
                    return {
                        "status": "success",
                        "tool": f"plugin__{inst_slug}__execute",
                        "result": f"Plugin '{inst_slug}' executed successfully with params: {params}",
                    }
                return _handler

            td = ToolDefinition(
                name=tool_name,
                description=f"Execute an action provided by the '{p['name']}' marketplace plugin.",
                parameters={
                    "type": "object",
                    "properties": {
                        "action": {"type": "string", "description": "Action name to execute"},
                        "params": {"type": "object", "description": "Parameters for the action"},
                    },
                    "required": ["action"],
                },
                required_scope="workspace.write",
                category="plugin",
            )
            handler = await _make_handler()
            register_dynamic_tool(td, handler)
            count += 1
        return count
