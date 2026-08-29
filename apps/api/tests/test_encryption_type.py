import os

# Ensure settings can construct even when run standalone (mirrors CI test env).
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-for-ci-only-32-chars-long!!")
os.environ.setdefault("ENCRYPTION_KEY", "MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///./dev.db")
os.environ.setdefault("LLM_API_KEY", "mock-key")
os.environ.setdefault("OTEL_SDK_DISABLED", "true")

from sqlalchemy import Column, Integer, create_engine, text
from sqlalchemy.orm import Session, declarative_base

from api.services.encryption import EncryptedString, decrypt_value, encrypt_value

Base = declarative_base()


class _Item(Base):
    __tablename__ = "enc_test"
    id = Column(Integer, primary_key=True)
    content = Column(EncryptedString)


def test_encrypted_string_round_trip():
    eng = create_engine("sqlite://")
    Base.metadata.create_all(eng)
    with Session(eng) as s:
        row = _Item(content="secret resume data")
        s.add(row)
        s.commit()
        # Python-side attribute stays plaintext
        assert row.content == "secret resume data"
        # Fresh load returns plaintext
        loaded = s.get(_Item, row.id)
        assert loaded.content == "secret resume data"
        # Raw DB column is ciphertext, not plaintext
        raw = s.execute(text("SELECT content FROM enc_test WHERE id = :i"), {"i": row.id}).scalar()
        assert raw != "secret resume data"
        assert raw.startswith("gAAAAA")  # Fernet token marker


def test_encrypted_string_legacy_plaintext_passthrough():
    # Non-token values are stored/returned as-is (gradual migration of old rows).
    assert decrypt_value(encrypt_value("hello")) == "hello"
