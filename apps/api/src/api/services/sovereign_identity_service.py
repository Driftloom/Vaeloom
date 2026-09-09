"""
PIOS Sovereign Identity & Cryptography Service.
Implements Pillar 5 of the PIOS Blueprint:
- Ed25519 Asymmetric Keypair Generation
- W3C Decentralized Identifiers (did:vaeloom:<user_id>)
- Canonical JSON Payload Hashing & Cryptographic Signing
- W3C DID Document generation
"""
from __future__ import annotations

import base64
import json
import logging
import uuid
from typing import Any

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ed25519
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schema import SovereignIdentity
from .encryption import decrypt_value, encrypt_value, is_encrypted

logger = logging.getLogger(__name__)


def canonicalize_json(data: Any) -> bytes:
    """Produces deterministic canonical UTF-8 bytes for cryptographic signing."""
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("utf-8")


class SovereignIdentityService:
    """Manages decentralized cryptographic identities and Ed25519 signing."""

    def generate_keypair(self) -> tuple[str, str]:
        """Generates a raw Ed25519 keypair encoded in standard Base64."""
        priv_key = ed25519.Ed25519PrivateKey.generate()
        pub_key = priv_key.public_key()

        priv_raw = priv_key.private_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PrivateFormat.Raw,
            encryption_algorithm=serialization.NoEncryption(),
        )
        pub_raw = pub_key.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw,
        )

        priv_b64 = base64.b64encode(priv_raw).decode("ascii")
        pub_b64 = base64.b64encode(pub_raw).decode("ascii")
        return priv_b64, pub_b64

    def sign_payload(self, private_key_b64: str, payload: Any) -> str:
        """Signs a JSON-serializable payload using an Ed25519 private key."""
        priv_raw = base64.b64decode(private_key_b64)
        priv_key = ed25519.Ed25519PrivateKey.from_private_bytes(priv_raw)
        canonical_bytes = canonicalize_json(payload)
        signature_raw = priv_key.sign(canonical_bytes)
        return base64.b64encode(signature_raw).decode("ascii")

    def verify_signature(self, public_key_b64: str, payload: Any, signature_b64: str) -> bool:
        """Cryptographically verifies that the signature matches the canonical payload."""
        try:
            pub_raw = base64.b64decode(public_key_b64)
            pub_key = ed25519.Ed25519PublicKey.from_public_bytes(pub_raw)
            sig_raw = base64.b64decode(signature_b64)
            canonical_bytes = canonicalize_json(payload)
            pub_key.verify(sig_raw, canonical_bytes)
            return True
        except (InvalidSignature, ValueError, Exception) as e:
            logger.debug("Cryptographic verification failed: %s", e)
            return False

    async def get_or_create_identity(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> SovereignIdentity:
        """Retrieves or creates a sovereign Ed25519 identity for the user."""
        stmt = select(SovereignIdentity).where(SovereignIdentity.user_id == user_id)
        res = await db.execute(stmt)
        identity = res.scalar_one_or_none()

        if identity is not None:
            return identity

        priv_b64, pub_b64 = self.generate_keypair()
        did = f"did:vaeloom:{user_id}"

        # EncryptedString transparently encrypts on bind and decrypts on load
        identity = SovereignIdentity(
            id=uuid.uuid4(),
            user_id=user_id,
            did=did,
            public_key=pub_b64,
            encrypted_private_key=priv_b64,
        )
        db.add(identity)
        await db.commit()
        await db.refresh(identity)
        return identity

    def get_decrypted_private_key(self, identity: SovereignIdentity) -> str:
        """Decrypts and returns the base64 Ed25519 private key for signing."""
        val = identity.encrypted_private_key
        if is_encrypted(val):
            return decrypt_value(val)
        return val

    async def get_did_document(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Builds a standard W3C DID document for the user."""
        identity = await self.get_or_create_identity(db, user_id)
        key_id = f"{identity.did}#key-1"

        return {
            "@context": [
                "https://www.w3.org/ns/did/v1",
                "https://w3id.org/security/suites/ed25519-2020/v1",
            ],
            "id": identity.did,
            "verificationMethod": [
                {
                    "id": key_id,
                    "type": "Ed25519VerificationKey2020",
                    "controller": identity.did,
                    "publicKeyBase64": identity.public_key,
                }
            ],
            "authentication": [key_id],
            "assertionMethod": [key_id],
        }


sovereign_identity_service = SovereignIdentityService()
