# Vaeloom AI Service (FastAPI, Python 3.12). See Docs/DevOps/Docker.md
FROM python:3.12-slim-bookworm AS base
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1
WORKDIR /app

# ---- deps ----
FROM base AS deps
RUN apt-get update && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*
COPY packages/python-common ./packages/python-common
COPY apps/ai-service/pyproject.toml ./apps/ai-service/pyproject.toml
RUN pip install --upgrade pip \
    && pip install ./packages/python-common \
    && pip install ./apps/ai-service

# ---- runtime ----
FROM base AS runtime
COPY --from=deps /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin
COPY apps/ai-service ./apps/ai-service
WORKDIR /app/apps/ai-service
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--app-dir", "src"]
