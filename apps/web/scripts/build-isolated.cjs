/**
 * Build into an isolated output directory.
 *
 * `next dev` and `next build` both write to `.next`. Running a production build
 * while a dev server is up replaces the dev server's manifests with production
 * ones (BUILD_ID, export-marker.json) and every route then fails with a bare
 * 500 — which has happened twice on this repo. This wrapper points the build at
 * `.next-build` so the two can never collide.
 *
 * Implemented in Node rather than `cross-env` so it works on Windows, macOS and
 * Linux with no extra dependency. Production/CI/Docker builds keep using
 * `next build` and therefore the default `.next`, so
 * `apps/web/Dockerfile`'s `.next/standalone` copy is unaffected.
 */
process.env.NEXT_DIST_DIR = process.env.NEXT_DIST_DIR || '.next-build';
require('next/dist/bin/next');
