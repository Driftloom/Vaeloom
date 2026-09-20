import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

if __name__ == "__main__":
    os.chdir(ROOT)
    import uvicorn
    print(f"Starting Vaeloom API Server in {ROOT} on http://0.0.0.0:8000...", flush=True)
    uvicorn.run(
        "api.main:app",
        host="0.0.0.0",
        port=8000,
        log_level="info",
        access_log=True,
    )
