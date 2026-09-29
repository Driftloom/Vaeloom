# ENT-P06 — 04 Dependency Governance, SBOM & Supply Chain Security

> **Phase:** `ENT-P06` (Technology Stack and Engineering Standards)  
> **Deliverable:** `DEL-ENT-P06-04` (v1.0)  
> **Owner:** Lead AppSec Engineer & Supply Chain Security Custodian  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Supply Chain Security Architecture & SLSA v1.2 Compliance

The Vaeloom Enterprise Platform adheres to the Supply-chain Levels for Software
Artifacts (SLSA) v1.2 framework at **Build Level 3**:

```mermaid
graph LR
    Dev[Developer Workstation] -->|Signed Git Commit| GitHub[GitHub Enterprise Repo]
    GitHub -->|Protected Branch Trigger| Runner[Isolated Ephemeral GitHub Runner]
    Runner -->|Hermetic Build| BuildEnv[Build Environment]
    BuildEnv -->|Generate Artifacts & SBOM| Artifacts[Docker Image & Binaries]
    Runner -->|Sigstore Cosign Signing| Provenance[Signed SLSA v1.2 Provenance]
    Artifacts --> Registry[Enterprise Container Registry (GHCR)]
    Provenance --> Registry
    Registry -->|Admission Controller Verification| K8s[Production Kubernetes Cluster]
```

### Key Security Invariants:

1. **Cryptographic Build Provenance:** Every container image produced in CI
   attaches a signed in-toto attestation containing source repository URL,
   commit SHA, build timestamp, and dependency hashes.
2. **Container Image Verification:** Production Kubernetes clusters enforce
   Kyverno / OPA Gatekeeper admission policies that verify Sigstore Cosign
   signatures before allowing container pods to start.
3. **Hermetic Builds:** Dependencies are fetched strictly from verified
   registries with checksum validation; arbitrary network downloads during build
   phases are disabled.

---

## 2. Software Bill of Materials (SBOM) Protocol

On every release candidate build, automated CI jobs generate machine-readable
SBOMs in both CycloneDX 1.5 JSON and SPDX 2.3 formats:

- **Generation Tools:** Syft and Trivy.
- **Artifact Location:** `evidence/sbom/vaeloom-enterprise-<version>.cdx.json`.
- **Scope Cataloged:**
  - 100% of direct and transitive Python PyPI dependencies (`uv.lock`).
  - 100% of direct and transitive Node.js npm packages (`pnpm-lock.yaml`).
  - All Debian/Ubuntu OS base packages inside container images.

---

## 3. Open Source License Compatibility Matrix

To protect enterprise proprietary intellectual property and prevent copyleft
contamination, all third-party dependencies are subjected to automated license
checking:

| License Category               | Permitted / Prohibited  | Allowed Licenses                                 | Usage Constraints                                                                  |
| :----------------------------- | :---------------------: | :----------------------------------------------- | :--------------------------------------------------------------------------------- |
| **Permissive Licenses**        |      **APPROVED**       | MIT, Apache 2.0, BSD-2-Clause, BSD-3-Clause, ISC | Full commercial use; preserve copyright notices in distribution bundles.           |
| **Weak Copyleft**              |     **RESTRICTED**      | LGPL-2.1, LGPL-3.0, MPL-2.0                      | Dynamically linked libraries only; zero modifications to library source code.      |
| **Strong Copyleft**            | **STRICTLY PROHIBITED** | GPL-2.0, GPL-3.0, AGPL-3.0                       | Prohibited in any client or server component; triggers immediate CI build failure. |
| **Non-Commercial / Ambiguous** | **STRICTLY PROHIBITED** | CC-BY-NC, SSPL, Commons Clause                   | Prohibited in enterprise deployments due to commercial licensing restrictions.     |

_Automated CI Enforcement:_ `license-checker` and `pip-licenses` run on every
PR; detection of prohibited licenses halts merge eligibility.

---

## 4. Continuous Vulnerability & Secret Scanning Pipeline

Every commit and pull request is scanned by three parallel security scanners:

1. **Secret Scanning (Gitleaks):** Scans all commits, diffs, and config files
   for private keys, JWT secrets, database connection strings, and cloud
   credentials. Pre-commit hooks block accidental local commits.
2. **Static Application Security Testing (SAST):** Semgrep and CodeQL audit
   source code against OWASP Top 10 vulnerabilities (SQLi, XSS, SSRF, IDOR).
3. **Software Composition Analysis (SCA):** Trivy continuously audits
   third-party packages against the National Vulnerability Database (NVD) and
   GitHub Advisory Database. Any dependency with an unresolved Critical or High
   CVE without an approved temporary exception blocks the build.

_Signed: Lead AppSec Engineer & Supply Chain Security Custodian — 2026-09-29_
