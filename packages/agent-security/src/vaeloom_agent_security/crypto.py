import base64
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


class EncryptionError(Exception):
    pass


class SecretEncryptor:
    def __init__(self, key_b64: str):
        try:
            self._key = base64.b64decode(key_b64)
            if len(self._key) != 32:
                raise ValueError("Key must be 32 bytes (AES-256)")
            self._aesgcm = AESGCM(self._key)
        except Exception as e:
            raise EncryptionError(f"Failed to initialize SecretEncryptor: {e}")

    def encrypt(self, plaintext: str) -> str:
        nonce = os.urandom(12)
        ct = self._aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
        combined = nonce + ct
        return base64.b64encode(combined).decode("utf-8")

    def decrypt(self, ciphertext_b64: str) -> str:
        try:
            combined = base64.b64decode(ciphertext_b64)
            nonce = combined[:12]
            ct = combined[12:]
            pt = self._aesgcm.decrypt(nonce, ct, None)
            return pt.decode("utf-8")
        except Exception as e:
            raise EncryptionError(f"Decryption failed or ciphertext tampered: {e}")
