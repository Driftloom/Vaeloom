"""
Capture Playwright poster images of each landing 3D beat.

The landing uses ONE shared WebGL context; each section's scene is a "beat".
When WebGL is unavailable we fall back to a static *poster* of the real scene
rather than a hand-drawn SVG. This script drives a headless browser to the
running dev server (with ?stageBeat=<beat> forcing the active beat) and saves a
screenshot of that beat's canvas into apps/web/public/landing/beats/<beat>.png.

Prereqs:
  - `pnpm dev:web` running on http://localhost:3000
  - playwright chromium installed:
      uv run --project apps/api playwright install chromium

Run:
  uv run --project apps/api python scripts/capture-landing-beats.py
"""
from __future__ import annotations

import os
import sys

from playwright.sync_api import sync_playwright

BEATS = ["hero", "journey", "memory", "agents", "connectors", "growth", "cta"]
BASE_URL = "http://localhost:3000"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "apps", "web", "public", "landing", "beats")

# Headless WebGL needs software rendering on CI/headless boxes.
LAUNCH_ARGS = [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
]


def main() -> int:
    os.makedirs(OUT_DIR, exist_ok=True)
    failed = False

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=LAUNCH_ARGS)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.set_default_timeout(45000)

        for beat in BEATS:
            url = f"{BASE_URL}/?stageBeat={beat}"
            print(f"-> capturing beat '{beat}' from {url}", flush=True)
            try:
                page.goto(url, wait_until="domcontentloaded")
                canvas_sel = f'[data-stage-beat="{beat}"] canvas'
                page.wait_for_selector(canvas_sel, timeout=45000)
                # Let a few frames render so the scene is fully drawn.
                page.wait_for_timeout(3000)
                canvas = page.query_selector(canvas_sel)
                if canvas is None:
                    print(f"   WARN: no canvas for beat '{beat}'", flush=True)
                    failed = True
                    continue
                out_path = os.path.join(OUT_DIR, f"{beat}.png")
                canvas.screenshot(path=out_path)
                size = os.path.getsize(out_path)
                print(f"   OK -> {out_path} ({size} bytes)", flush=True)
            except Exception as exc:  # noqa: BLE001 - report and continue
                print(f"   ERROR capturing beat '{beat}': {exc}", flush=True)
                failed = True

        page.close()
        browser.close()

    print("Done." if not failed else "Done with errors (see above).", flush=True)
    import os as _os

    _os._exit(1 if failed else 0)


if __name__ == "__main__":
    sys.exit(main())
