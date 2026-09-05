FROM python:3.12-slim AS builder
WORKDIR /app
COPY pyproject.toml ./
COPY src/ src/
RUN pip install --no-cache-dir setuptools wheel \
 && pip install --no-cache-dir . --no-build-isolation

FROM python:3.12-slim AS runner
WORKDIR /app
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
COPY --from=builder /usr/local/bin /usr/local/bin
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /app/src/api/ ./api/
COPY alembic/ alembic/
COPY pyproject.toml .

# Bake headless Chromium and Linux system dependencies directly into the runner image
RUN playwright install --with-deps chromium && rm -rf /var/lib/apt/lists/*

ENV PYTHONPATH=/app
ENV SERVICE_ENVIRONMENT=production
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && uvicorn api.main:app --workers 4 --host 0.0.0.0 --port 8000"]
