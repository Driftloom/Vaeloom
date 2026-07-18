import uuid
from datetime import datetime

from sqlalchemy import String, Text, Integer, BigInteger, DateTime, Float, func
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class Memory(Base):
    __tablename__ = "memories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="active", index=True)
    title: Mapped[str | None] = mapped_column(String(500))
    summary: Mapped[str | None] = mapped_column(Text)
    content: Mapped[str | None] = mapped_column(Text)
    content_hash: Mapped[str | None] = mapped_column(String(64))
    size: Mapped[int | None] = mapped_column(Integer)
    embedding: Mapped[list[float] | None] = mapped_column(ARRAY(Float), nullable=True)
    metadata: Mapped[dict | None] = mapped_column(JSONB, default=dict)
    tags: Mapped[list[str] | None] = mapped_column(ARRAY(String(100)))
    tenant_id: Mapped[str | None] = mapped_column(String(100), index=True)
    user_id: Mapped[str | None] = mapped_column(String(100), index=True)
    workspace_id: Mapped[str | None] = mapped_column(String(100), index=True)
    source_type: Mapped[str | None] = mapped_column(String(100))
    source_uri: Mapped[str | None] = mapped_column(String(1000))
    source_label: Mapped[str | None] = mapped_column(String(500))
    connector_id: Mapped[str | None] = mapped_column(String(100))
    vector_id: Mapped[str | None] = mapped_column(String(100))
    graph_node_id: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
