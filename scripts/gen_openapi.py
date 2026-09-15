import os
import sys
from pathlib import Path
import yaml

os.environ.setdefault("JWT_SECRET", "test-jwt-secret-for-ci-only-32-chars-long!!")
os.environ.setdefault("ENCRYPTION_KEY", "MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///./dev.db")
os.environ.setdefault("LLM_API_KEY", "mock-key")
os.environ.setdefault("OTEL_SDK_DISABLED", "true")

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "apps" / "api" / "src"))

from api.main import app

spec = app.openapi()
out_path = REPO_ROOT / "docs" / "backend" / "openapi.yaml"
out_path.parent.mkdir(parents=True, exist_ok=True)

with open(out_path, "w", encoding="utf-8") as f:
    yaml.dump(spec, f, sort_keys=False, allow_unicode=True)

print(f"Generated {out_path} with {len(spec.get('paths', {}))} paths.")
