# `vaeloom-python-common`

Shared Python utilities, base models, cryptography helpers, and telemetry integration across Python services and scripts.

## Installation

Within the monorepo using `uv`:

```bash
uv add --project apps/api ../../packages/python-common
```

## Modules

- `logging`: Structured JSON logging with correlation ID propagation.
- `crypto`: Field-level encryption (AES-256-GCM) and key rotation helpers.
- `models`: Common Pydantic base classes and JSON schema generators.
