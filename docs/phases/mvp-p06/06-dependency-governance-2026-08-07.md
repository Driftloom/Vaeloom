# MVP-P06 — 06. Dependency Governance (DEL-MVP-P06-04)

> Owner: Security Engineer · Enforced from first commit (already largely in
> place — verify + close gaps).

## 1. Controls

| Control | Policy | Existing evidence | Gap |
| ---------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------- |
| License policy | Allow MIT/Apache-2.0/BSD/CC-BY-4.0 (eval datasets CC-BY-4.0 only — CC BY-NC excluded from product, P02) | MIT in pyproject; HF/MIT datasets chosen | **GAP: automated license check (add at P16)** |
| Vulnerability scanning | `pnpm audit` + dependency scan in CI | security-scan + security-audit workflows exist | verify coverage of Python deps (pip-audit/OSV) |
| Secret scanning | secrets never committed; secret detection in CI | gitignore, .env.example only | **GAP: gitleaks-class scanner (add at P16)** |
| Dependency health | pinned per `04-version-policy.md`; EOL watch | lockfiles present | GAP: scheduled EOL check |
| Artifact provenance | SBOM + signatures | docker-build workflow exists | **SLSA-lite at P16/P19 (EXT-10)** |
| Registry hygiene | only approved registries (npm/pypi); no `file:`-swapped deps | pnpm-workspace + packageManager pinned | verify |
| Plugin/connector deps | plugins sandboxed (subprocess, P0.2); connectors reviewed | plugin-sdk types; sandbox exists | P12 plugin boundary tests |

## 2. Rules

1. New dependency → justification in PR (license, maintenance, security posture,
 cost $0, exit path) — reviewer veto possible.
2. Direct deps only; no transitive pin tricks; no vendored forks without ADR.
3. Lockfiles committed; reproducible installs (`pnpm install --frozen-lockfile`
 in CI).
4. Failed scans block merge (CI gate); findings triaged per severity.
5. Eval datasets: only licensed data (P02 §03) — CC BY-NC excluded from product;
 provenance recorded per dataset/version at P12.
6. Model/prompt/tool/embedding versions recorded (INT-02 §4) — registry at P12.

## 3. Threat context

OWASP LLM supply chain: model/tool swap risk — mitigation = version registry +
eval re-run before promotion (RISK-P03-03). Plugins: subprocess isolation +
capability allowlists (plugin-sdk).
