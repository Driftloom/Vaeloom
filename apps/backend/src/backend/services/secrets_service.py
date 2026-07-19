import os


class SecretsService:
    def get(self, key: str, default: str | None = None) -> str | None:
        return os.environ.get(key, default)

    def get_or_throw(self, key: str) -> str:
        value = os.environ.get(key)
        if value is None:
            raise ValueError(f"Required secret not configured: {key}")
        return value

    def has(self, key: str) -> bool:
        return key in os.environ

    def list_keys(self) -> list[str]:
        return list(os.environ.keys())


secrets_service = SecretsService()
