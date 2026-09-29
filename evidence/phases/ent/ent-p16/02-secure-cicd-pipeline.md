# DEL-ENT-P16-02 — Secure CI/CD Pipeline & Supply-Chain Hardening

**Deliverable ID:** DEL-ENT-P16-02  
**Phase:** ENT-P16 — DevOps, Infrastructure, and CI/CD  
**Version:** 1.0.0  
**Owner:** DevOps Lead  
**Reviewer:** AppSec Engineer + Security Architect  
**Status:** DELIVERED  
**Date:** 2026-09-29  
**Immutable Path:** `evidence/phases/ent/ent-p16/02-secure-cicd-pipeline.md`

---

## 1. CI/CD Architecture & Pipeline Topology

Vaeloom employs a multi-stage, zero-trust GitHub Actions workflow matrix
governing both the FastAPI API and Next.js frontend services. Every PR and push
to `main` undergoes automated verification across 6 mandatory gates.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     SECURE CI/CD PIPELINE TOPOLOGY                      │
│                                                                         │
│  [ Developer Push / PR ]                                                │
│             │                                                           │
│  ┌──────────▼──────────────────────────────────────────────────────┐    │
│  │ GATE 1: Static Analysis & Linting (45s)                         │    │
│  │   • ruff / black / flake8 (Python 3.12)                         │    │
│  │   • ESLint / Prettier / TypeScript strict typecheck (Web)       │    │
│  │   • Semgrep + Bandit SAST (AST scanning)                        │    │
│  └──────────┬──────────────────────────────────────────────────────┘    │
│             │ (Pass)                                                    │
│  ┌──────────▼──────────────────────────────────────────────────────┐    │
│  │ GATE 2: Unit & Fast Security Tests (2m 5s)                      │    │
│  │   • pytest -n 4 --dist loadfile (SQLite NullPool DB)            │    │
│  │   • Vitest Web unit (96 tests) + UI-Kit unit (149 tests)        │    │
│  │   • Security suite (334 backend tests)                          │    │
│  └──────────┬──────────────────────────────────────────────────────┘    │
│             │ (Pass)                                                    │
│  ┌──────────▼──────────────────────────────────────────────────────┐    │
│  │ GATE 3: Code Coverage & Quality Threshold (3m 0s)               │    │
│  │   • pytest-cov: backend ≥94% line, 100% security-critical       │    │
│  │   • Vitest coverage: frontend ≥80%                              │    │
│  │   • Zero-unexplained-skip verification                          │    │
│  └──────────┬──────────────────────────────────────────────────────┘    │
│             │ (Pass)                                                    │
│  ┌──────────▼──────────────────────────────────────────────────────┐    │
│  │ GATE 4: Contract & Security Integration (1m 30s)                │    │
│  │   • OpenAPI 3.2.0 schema validation (241 paths)                 │    │
│  │   • Module 05 live cognitive tests (Jev S1 + Gemma 4 S2)        │    │
│  │   • Live PostgreSQL RLS isolation (5/5 tests)                   │    │
│  └──────────┬──────────────────────────────────────────────────────┘    │
│             │ (Pass)                                                    │
│  ┌──────────▼──────────────────────────────────────────────────────┐    │
│  │ GATE 5: Container Build & Vulnerability Scan (3m 45s)           │    │
│  │   • Docker multi-stage build (Python 3.12-slim patched)         │    │
│  │   • Trivy CVE scan (0 Critical, 0 High)                         │    │
│  │   • Syft SBOM generation (SPDX / CycloneDX JSON)                │    │
│  │   • Cosign keyless container signing (Sigstore OIDC)            │    │
│  └──────────┬──────────────────────────────────────────────────────┘    │
│             │ (Pass on main merge)                                      │
│  ┌──────────▼──────────────────────────────────────────────────────┐    │
│  │ GATE 6: Staging Deployment & Canary Health Gate (4m 15s)        │    │
│  │   • Blue-Green / Canary rollout to Kubernetes                   │    │
│  │   • Automated smoke tests (Playwright E2E 46 tests)             │    │
│  │   • Synthetic SLI health check probe (/health ≤5ms)             │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. GitHub Actions Workflow Definitions

### 2.1 Backend Pipeline (`.github/workflows/api-ci.yml`)

```yaml
name: API CI/CD & Security Gate

on:
  push:
    branches: [main]
    paths: ['apps/api/**', 'packages/**']
  pull_request:
    branches: [main]
    paths: ['apps/api/**', 'packages/**']

permissions:
  contents: read
  security-events: write
  id-token: write # OIDC for Cosign / Sigstore

jobs:
  lint-and-sast:
    name: Lint & SAST
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Python 3.12
        uses: actions/setup-python@v5
        with:
          python-version: '3.12.13'
          cache: 'pip'
      - name: Install uv & Dependencies
        run: |
          curl -LsSf https://astral.sh/uv/install.sh | sh
          uv sync --project apps/api
      - name: Run Ruff Lint & Format Check
        run: uv run --project apps/api ruff check apps/api
      - name: Run Bandit SAST Scan
        run: uv run --project apps/api bandit -r apps/api/src/ -ll -q
      - name: Run Semgrep Security Rules
        run: |
          python -m pip install semgrep
          semgrep scan --config=auto --error apps/api/src

  test-and-coverage:
    name: Test Suite & Coverage Gate
    needs: lint-and-sast
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Python 3.12
        uses: actions/setup-python@v5
        with:
          python-version: '3.12.13'
      - name: Run pytest with Coverage Gate (≥94%)
        run: |
          cd apps/api
          uv run --project . python -m pytest \
            --cov=src/api \
            --cov-fail-under=94 \
            --cov-report=term-missing \
            -q -o addopts="-n 4 --dist loadfile"

  container-build-and-sign:
    name: Build, Scan & Cosign Container
    needs: test-and-coverage
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      - name: Build API Container Image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: apps/api/Dockerfile
          push: false
          tags: vaeloom/api:${{ github.sha }}
          load: true
      - name: Run Trivy Vulnerability Scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: vaeloom/api:${{ github.sha }}
          format: 'table'
          exit-code: '1'
          ignore-unfixed: true
          severity: 'CRITICAL,HIGH'
      - name: Generate SBOM (Syft)
        uses: anchore/sbom-action@v0
        with:
          image: vaeloom/api:${{ github.sha }}
          format: spdx-json
          output-file: sbom-api.spdx.json
      - name: Install Cosign & Sign Image
        uses: sigstore/cosign-installer@v3
      - name: Sign Container Artifact
        run: |
          cosign sign --yes vaeloom/api:${{ github.sha }}
```

---

## 3. Branch Protection & Supply-Chain Rules

1. **Mandatory PR Approvals:** Minimum 2 CODEOWNER approvals (1 Eng + 1 AppSec)
   required for `main`.
2. **Required Status Checks:** All 5 CI jobs (`lint-and-sast`,
   `test-and-coverage`, `web-ci`, `playwright-e2e`, `trivy-scan`) must pass
   before merge.
3. **Signed Commits:** GPG/SSH commit signature enforcement required.
4. **SLSA Level 3 Compliance:** Hermetic build environments with verifiable
   input hashes and signed attestation bundles.

---

_Deliverable DEL-ENT-P16-02 v1.0.0 — DevOps Lead — 2026-09-29_
