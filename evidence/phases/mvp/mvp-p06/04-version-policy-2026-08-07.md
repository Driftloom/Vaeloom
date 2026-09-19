# MVP-P06 — 04. Version Policy (DEL-MVP-P06-02)

> Owner: Platform Engineer · Pin supported versions; automated lifecycle watch
> for EOL/advisories; update/deprecation policy.

## 1. Pinned baseline (from live manifests, EVD-P06-001)

| Component | Pin strategy | Current | Policy |
| --------------------------- | -------------------------------------------- | ------------- | ------------------------------------------------ |
| Node | engines >=20; toolchain pinned via pnpm 9.12 | >=20 | minor updates w/ CI |
| pnpm | exact (packageManager field) | 9.12.0 | upgrades via PR + CI |
| Nx | major-locked | 20.0.0 | major upgrades = ADR + PR |
| Next.js | major-locked | ^15 | minor auto w/ CI; major = ADR |
| React | major-locked | ^18.3 | major = ADR |
| TypeScript | minor-locked | ^5.5 | minor w/ CI |
| Python | >=3.12 (runs 3.14) | 3.14 | verify before bump |
| FastAPI | minor-locked | >=0.111 | minor w/ CI |
| SQLAlchemy | major-locked | >=2.0.30 | major = ADR |
| Pydantic | major-locked | >=2.7 | major = ADR |
| Redis client | major-locked | >=5.0 | major = ADR |
| pgvector | minor-locked | >=0.2.5 | watch Postgres compat |
| LLM SDKs (anthropic/openai) | minor-locked | >=0.34/>=1.30 | provider API changes = eval re-run (RISK-P03-03) |
| OTel | minor-locked | >=0.45b | spec drift watch (EXT-09) |
| Google API client | minor-locked | >=2.130 | Gmail API compat tests |

## 2. Support/lifecycle rules

1. **EOL watch:** automated check (CI schedule) for EOL versions + security
 advisories (Node LTS, Next major, Python release cadence, FastAPI/Pydantic).
2. **Update cadence:** patch = CI-triggered; minor = PR + CI + affected tests;
 major = ADR + migration plan + rollback (change control P03 §7).
3. **Deprecation:** framework/package deprecation → documented decision to stay
 (with exit plan) or scheduled migration with owner + date (INT-02 §5 pins).
4. **Version records:** model/prompt/tool/retrieval/chunking/embedding/policy
 versions recorded at runtime (INT-02 §4) — P12 implements registry.
5. **Never pin-to-practice-damage:** no silent downgrades to "make tests pass"
 (prompt §13).

## 3. Provider-exit playbook requirement

Before adoption of any new provider: record exit criteria (data export, API
compatibility, cost model, kill switch) — see `07-cost-exit-strategy.md`.
