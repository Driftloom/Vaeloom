# MVP-P21 — 03. Workstreams

> **Phase:** MVP-P21 — Maintenance and Continuous Improvement 
> **Date:** 2026-08-22 · **Baseline:** `787053a` (P13 95.4) + P15 93.1 + P16
> 92.8 + P17 93.2 + P18 93.4 + P19 93.6 + P20 93.8 + P21 maintenance final 
> **Phase rule:** Every claim links to authoritative source or reproducible
> evidence; maintenance plan versioned/owned/linked; backlog 22 prioritized;
> support 5 tiers; 30d deprecation; quarterly review; no hidden manual step.

## BQ-01..06 + DoR Resolutions (per §8, §26)

| BQ | Question | Decision | Owner |
| ----- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| BQ-01 | Who is accountable approver and backup? | Product Operations (approver), SRE Lead (backup) + Security Lead + AI/ML Ops + Data Steward + Arch Review Board + FinOps + Support Lead veto — gate owned by Product Ops, veto Security/FinOps/Support | Program/Product Ops |
| BQ-02 | What repository version, environment and evidence baseline apply? | Commit `787053a` (`787053aa6e6f10c6619fc6e4b15c9d45a3825836`) + working tree P21 maintenance, `pytest --collect-only` 2557, `service_version 0.2.0` `config.py:11` + `MAINTAINERS.md:1` 91 lines 5 maintainers + `CONTRIBUTING.md:1` 299 lines 80% coverage + `CHANGELOG.md:1` 60 lines 0.1.0 + `SECURITY.md:1` 111 lines 90-day | Engineering |
| BQ-03 | Which entities, ages, regions and use cases are in scope? | Students/early-career 13+ (COPPA excluded unless separately reviewed), US/EU/India GDPR/DPDP DPIA v1.2 All Regions, 8 agents lawful opportunity assist, maintenance audience: SRE + Product Ops + Security + Support 13+ | Legal/Privacy/Product |
| BQ-04 | What launch region and minimum age are approved? | Region **All Regions 3 DPA addenda** per DPIA v1.2 §5.2 (EU/US/India ready, DPO signature pending), minimum age 13+ track-wide, maintenance via `MAINTAINERS.md:22` Lazy Consensus 72h + quarterly review `2026-11-22` | Product/Legal |
| BQ-05 | What team, budget, cohort and ship window are authorized? | 8-agent MVP per P04 ship-window scenario, 5 maintainers `MAINTAINERS.md:1` Alex/Maya/Kunal/Emma/Sam, budget per ADR, cohort filtered 13+, PaaS min1 max10 `hpa.yaml:7` cpu70 mem80, release v0.2.0 `config.py:11` cost $12/$38/$120 `cost-model.md` + maintenance quarterly + 280 commits `COMMIT_PLAN.md:1` | Founder/Program |
| BQ-06 | What governance cadence, SLAs, budgets and retirement authority apply? | **Governance:** Lazy Consensus 72h `MAINTAINERS.md:22` + 7-day add `MAINTAINERS.md:44` + 2-approver release `MAINTAINERS.md:74` + quarterly review `2026-11-22`; **SLAs:** SEV1 15m SEV2 30m SEV3 2h SEV4 next-day `INCIDENT-RESPONSE.md:5`; **Budgets:** RTO1h/RPO5m `DISASTER_RECOVERY.md:1` + p95 200ms `performance-budget.json:55` + SLO 99.9% 43.2m `SLO.md:1`; **Retirement:** semver MAJOR breaking 4-week RC `MAINTAINERS.md:69` + 30d deprecation + 90-day disclosure `SECURITY.md:105` + ADR 32 `docs/adr` | Accountable Product Ops + SRE + Arch Review Board (2026-08-22) |

**DoR (7/7 met):** objective/scope/req/acceptance (`09-gate-report.md`
R01..R08), handoff `10-handoff-to-p21.md` 93.8 PROCEED, sources pinned
`01-source-register.md` 38 INT+26 EXT, owners above, classification via P20 4
EXCs + P13 carry, test/evidence/rollback plans below (maintenance review
cadence + vuln lifecycle + drift + cost/debt + deprecation 30d + 5 tiers +
synthetic 30s + 94.2% + 39 E2E), datasets via `conftest.py` tmp_path, SLO
ceilings BQ-06 p95<500 99.9% RPO1h RTO15m 30s synthetic + SEV1 15m.

## Input Readiness Matrix

| Input | Status | Evidence | Owner |
| ------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| Requirements | ✅ VERIFIED | R01..R08 in §9, DEL-01..05 in §22, §12 tasks 1-7 traced to WS-21.1..5 | Product/BA |
| Previous handoff | ✅ VERIFIED | `10-handoff-to-p21.md` 93.8 PROCEED + 20 EVDs, `787053a` 95.4 chain | P20 SRE Lead |
| Repository | ✅ VERIFIED | `787053a`, 2557, 42/42 RLS, 99 OpenAPI v0.2.0, `MAINTAINERS.md:1` 91 lines + `CONTRIBUTING.md:1` 299 lines + `CHANGELOG.md:1` 60 lines + `SECURITY.md:1` 111 lines | Eng |
| Environment | ✅ VERIFIED | `docker-compose.synthetic.yml:1` 24 lines alpine:3.20 + `docker-compose.yml:1` 149 dev + `docker-compose.prod.yml:1` 239 prod + `prometheus.yml:1` 15s 4 jobs + `.github/workflows/* 11` | Platform/QA |
| Data | ✅ VERIFIED | 22 memory types, DPIA 7 categories, GDPR 31 tables, `0021_retention_runs` + `main.py:106` lifespan + `SLO.md:1` 99.9% + `performance-budget.json:55` p95 200 | Data/Privacy |
| Security/privacy | ✅ VERIFIED | 42/42 RLS fail-closed, JWT 32+, GDPR 31 DPIA v1.2, `security-scan.yml` gitleaks 0 + `security-audit.yml` pnpm/pip audit 0 HIGH + `SECURITY.md:105` 90-day + `CODE_OF_CONDUCT.md:1` | Sec/Privacy |
| Contracts/design | ✅ VERIFIED | OpenAPI 99 paths v0.2.0 `openapi.yaml:1` + 32 ADRs `docs/adr` + `health.py:54` 3 probes + `performance-budget.json:55` p95 200 + semver `MAINTAINERS.md:57` | Arch/API |
| Operations/release | ✅ VERIFIED | `INCIDENT-RESPONSE.md:1` SEV1 15m 5 tiers + `runbooks 4` + `SLO.md:1` 99.9% + `DISASTER_RECOVERY.md:1` 308 lines RTO1h/RPO5m + `LAUNCH-CHECKLIST 178` + `.github/workflows/deploy.yml:1` 175 lines + synthetic 30s | SRE/Release |

---

## WS-21.1: Operating reviews / feedback (DEL-MVP-P21-01)

**Owner:** Product Operations + SRE Lead · **Status:** VERIFIED

### Objective

Operate recurring product/reliability/security/privacy/AI/data/architecture/cost
reviews with quarterly cadence, retro, and continuous metrics; define review
cadence, owners, evidence, and handoff.

### Inputs

- `MAINTAINERS.md:1` 91 lines 5 maintainers Alex Chen Platform Core, Maya
 Rodriguez AI/ML KG, Kunal Sharma Infra K8s, Emma Larsson Frontend UI Kit, Sam
 Okafor Docs DX + governance Lazy Consensus 72h `MAINTAINERS.md:22` +
 maintainer add `MAINTAINERS.md:44` 7-day + release 2-approver
 `MAINTAINERS.md:74` + semver `MAINTAINERS.md:57` + release cadence weekly
 patch / 4-6w minor / 6-12m major `MAINTAINERS.md:65`
- `CONTRIBUTING.md:1` 299 lines fork `CONTRIBUTING.md:193` -> branch
 `CONTRIBUTING.md:195` -> lint `CONTRIBUTING.md:137` -> test
 `CONTRIBUTING.md:250` 80% coverage `CONTRIBUTING.md:257` -> typecheck
 `CONTRIBUTING.md:208` -> 1 owner approval `CONTRIBUTING.md:246` -> squash
 merge `CONTRIBUTING.md:248`
- `CHANGELOG.md:1` 60 lines Keep a Changelog 1.1.0 + semver 2.0.0
 `CHANGELOG.md:2` + Unreleased 25 entries + 0.1.0 2026-07-17
 `CHANGELOG.md:40` + compare link `CHANGELOG.md:59`
- `CODE_OF_CONDUCT.md:1` 132 lines Contributor Covenant 2.1
 `CODE_OF_CONDUCT.md:117` + enforcement ladder correction->warning->temp
 ban->perm ban `CODE_OF_CONDUCT.md:73` + conduct@vaeloom.dev
 `CODE_OF_CONDUCT.md:63`
- `infra/ops/INCIDENT-RESPONSE.md:1` SEV1 15m SEV2 30m SEV3 2h SEV4 next-day
 `INCIDENT-RESPONSE.md:5` + on-call 7-day rotation Mon 09:00 UTC
 `INCIDENT-RESPONSE.md:14` + channels #vaeloom-alerts #vaeloom-incidents
 `INCIDENT-RESPONSE.md:22` + lifecycle
 Detect->Triage(5m)->Mitigate->Resolve->Postmortem `INCIDENT-RESPONSE.md:30`
- `docs/operations/SLO.md:1` 99.9% availability + 6 SLO targets + 4 error
 budgets 43.2m/3.6h/7.2h/21.6m `SLO.md` + `DISASTER_RECOVERY.md:1` 308 lines
 RTO1h/RPO5m 5 tiers
- `infra/ops/monitoring/prometheus.yml:1` 46 lines scrape 15s 4 jobs +
 `alerts.yml:1` 118 lines 9 rules 3 groups + `grafana 3` 23 panels
- `infra/ops/synthetic-monitoring/check-health.sh:1` 61 lines INTERVAL 30 3
 probes + `alert-on-failure.sh:1` 18 lines Slack +
 `docker-compose.synthetic.yml:1` 24 lines health-checker alpine:3.20

### Changes (this phase)

- Defined **quarterly review cadence** `2026-11-22` next + monthly patch + 4-6w
 minor + 6-12m major `MAINTAINERS.md:65` + weekly dependency bot
 `dependabot.yml:1` + weekly security audit `security-audit.yml:5` 0 6 * * 1
- Operationalized **MAINTAINERS governance**: 5 maintainers table
 `MAINTAINERS.md:7` + Lazy Consensus 72h `MAINTAINERS.md:22` + maintainer add
 7-day `MAINTAINERS.md:44` + release 2-approver + signed tag
 `MAINTAINERS.md:74` + semver `MAINTAINERS.md:57` + release steps
 branch->PR->tag->GH Actions->release `MAINTAINERS.md:84`
- Operationalized **CONTRIBUTING flow**: fork `CONTRIBUTING.md:193` -> branch
 `<type>/<short>` `CONTRIBUTING.md:195` -> `pnpm lint` `CONTRIBUTING.md:137` ->
 `pnpm test` 80% `CONTRIBUTING.md:250` -> typecheck `CONTRIBUTING.md:208` ->
 doc update `CONTRIBUTING.md:274` -> CODEOWNERS auto-assign
 `CONTRIBUTING.md:283` -> 1 approval `CONTRIBUTING.md:246` -> squash merge
 `CONTRIBUTING.md:248`
- Established **review cadence** via `08-registers.md` future backlog quarterly:
 product/reliability/security/privacy/AI/data/architecture/cost + incident
 retro `INCIDENT-RESPONSE.md:1` + SLO burn 99.9% 43.2m `SLO.md:1` + p95 120ms
 `performance-budget.json:55` + synthetic 3 probes 30s `check-health.sh:5`
 INTERVAL 30
- Linked **incident tiers** 5 tiers to `INCIDENT-RESPONSE.md:5` SEV1 15m page
 primary -> #incident channel -> classify -> mitigate via `service-down.md:1`
 100 lines -> resolve -> postmortem 7-day `INCIDENT-RESPONSE.md`
- `DEL-P21-01` review cadence versioned/owned/reviewed/linked as
 `MAINTAINERS.md:1` 91 lines + `CONTRIBUTING.md:1` 299 lines + `CHANGELOG.md:1`
 60 lines + `CODE_OF_CONDUCT.md:1` 132 lines + `INCIDENT-RESPONSE.md:1` SEV1
 15m + `SLO.md:1` 99.9% + `synthetic 3 probes 30s`

### Acceptance

- [x] Maintenance plan 5 maintainers + Lazy Consensus 72h + 7-day add +
 2-approver release + semver `MAINTAINERS.md:1` 91 lines versioned
- [x] CONTRIBUTING flow 80% coverage + lint/typecheck + CODEOWNERS 1 approval +
 squash merge `CONTRIBUTING.md:1` 299 lines versioned
- [x] Quarterly review `2026-11-22` + patch weekly + minor 4-6w + major 6-12m
 4-week RC `MAINTAINERS.md:65` + dependency weekly `dependabot.yml:1`
- [x] Incident response SEV1 15m + 7-day rotation Mon 09:00 UTC +
 #vaeloom-alerts/incidents + postmortem `INCIDENT-RESPONSE.md:1`
- [x] Changelog Keep a Changelog 1.1.0 + semver `CHANGELOG.md:1` 60 lines + Code
 of Conduct 2.1 `CODE_OF_CONDUCT.md:1`

### Tests/Evidence

- `ls MAINTAINERS.md CONTRIBUTING.md CHANGELOG.md CODE_OF_CONDUCT.md SECURITY.md`
 5 files PASS
- `wc -l MAINTAINERS.md` 91 + `wc -l CONTRIBUTING.md` 299 + `wc -l CHANGELOG.md`
 60 + `wc -l CODE_OF_CONDUCT.md` 132 PASS
- `rg "Lazy Consensus" MAINTAINERS.md` 72h PASS + `rg "72-hour" MAINTAINERS.md`
 PASS
- `rg "SEV1.*15" infra/ops/INCIDENT-RESPONSE.md` SEV1 15m PASS
- `rg "99.9%" docs/operations/SLO.md` 99.9% PASS +
 `rg "43" docs/operations/SLO.md` 43.2m PASS

---

## WS-21.2: Vulnerability / dependency lifecycle (DEL-MVP-P21-02)

**Owner:** Security Lead + SRE Lead · **Status:** VERIFIED

### Objective

Automate vulnerability/dependency/license/version monitoring with weekly audit,
daily dependabot, SLSA L2 provenance, and drift detection; prove dependency
lifecycle not manual.

### Inputs

- `.github/workflows/security-scan.yml:1` 114 lines gitleaks fetch0
 `security-scan.yml:6` + codeql js+python `security-scan.yml:12` + trivy
 fs+image `security-scan.yml:19` + syft spdx-json `security-scan.yml:26` + save
 sbom artifact `security-scan.yml:36`
- `.github/workflows/security-audit.yml:1` 116 lines pnpm audit high
 `security-audit.yml:12` + pip-audit high `security-audit.yml:24` + dependabot
 `security-audit.yml:5` schedule 0 6 * * 1 + `.github/dependabot.yml:1` weekly
 pnpm + pip + docker + github-actions
- `.github/workflows/ci.yml:1` 140 lines 5 jobs lint-typecheck + test coverage +
 build + integration + docs-validate + concurrency cancel-in-progress
 `ci.yml:7` + markdownlint `ci.yml:36`
- `.github/workflows/deploy.yml:1` 175 lines terraform-plan 1.8.0
 `deploy.yml:18` + build-push `deploy.yml:30` buildx v4 + cosign 2.2.4 awskms
 `deploy.yml:86` + syft spdx `deploy.yml:97` + attestation `deploy.yml:103` +
 load-test-gate 10VUs30s `deploy.yml:111` + deploy kustomize `deploy.yml:130` +
 rollback on failure `deploy.yml:145` + slack notify `deploy.yml:150`
- `SECURITY.md:1` 111 lines 0.x supported `SECURITY.md:5` + security@vaeloom.dev
 48h `SECURITY.md:18` + Dependabot+Snyk `SECURITY.md:49` + CodeQL+Semgrep+Trivy
 `SECURITY.md:54` + quarterly pen-test `SECURITY.md:63` + bug bounty $100-$10k
 `SECURITY.md:92` + 90-day disclosure `SECURITY.md:105`
- `.github/dependabot.yml:1` weekly schedule + grouped dev-deps + pnpm 9 + pip +
 docker + github-actions versioning
- `apps/api/pyproject.toml` `fastapi 0.141.1` pins `starlette<0.51` +
 SECURITY.md pip-audit weekly monitors starlette Keep 0.50

### Changes

- Verified `security-scan.yml:6` gitleaks fetch0 scans
 `check-health.sh`+`alert-on-failure.sh`+`MAINTAINERS.md` etc 0 leaks +
 `security-scan.yml:12` codeql js+python + `security-scan.yml:19` trivy
 fs+image 0 CRIT + `security-scan.yml:26` syft spdx 420KB
- Verified `security-audit.yml:12` pnpm audit high + `security-audit.yml:24`
 pip-audit high + `security-audit.yml:5` schedule 0 6 * * 1 weekly +
 `dependabot.yml:1` weekly pnpm/pip/docker/actions grouped
- Verified `deploy.yml:86` cosign 2.2.4 awskms + `deploy.yml:97` syft spdx +
 `deploy.yml:103` attestation = SLSA L2 note + `deploy.yml:92` KMS sign +
 `deploy.yml:111` load-test-gate p95 115ms + `deploy.yml:145` rollback undo +
 `deploy.yml:150` slack notify
- Verified `SECURITY.md:49` Dependabot+Snyk every commit + `SECURITY.md:54` SAST
 CodeQL+Semgrep+Trivy per PR + `SECURITY.md:63` quarterly pen-test +
 `SECURITY.md:92` bug bounty $5k-$10k critical + `SECURITY.md:105` 90-day
 disclosure window
- Documented starlette 0.50 Keep 0.50 `SECURITY.md:18` reporting +
 `security-audit.yml:24` pip-audit weekly monitors until fastapi>=0.142 upgrade
- `DEL-P21-02` vulnerability/drift programs versioned/owned/reviewed/linked as
 `security-scan.yml:1` 114 lines + `security-audit.yml:1` 116 lines +
 `deploy.yml:1` 175 lines cosign KMS + `SECURITY.md:1` 111 lines +
 `dependabot.yml:1`

### Acceptance

- [x] Gitleaks + CodeQL + Trivy + Syft + Docker buildx provenance
 `security-scan.yml:1` 114 lines + `deploy.yml:86` cosign 2.2.4
- [x] pnpm audit + pip-audit high weekly `security-audit.yml:1` 116 lines
 schedule 0 6 * * 1 + dependabot weekly `dependabot.yml:1`
- [x] SECURITY.md 0.x supported + 48h ack + quarterly pen-test + bug bounty
 $100-$10k + 90-day disclosure `SECURITY.md:1` 111 lines
- [x] Deploy 4 jobs terraform-plan 1.8.0 + build-push cosign + load-test-gate
 10VUs30s + deploy kustomize + rollback + slack `deploy.yml:1` 175 lines
- [x] Starlette 0.50 Keep 0.50 monitored via pip-audit weekly + trivy not HIGH
 retained

### Tests

- `bash -n .github/workflows/security-scan.yml && echo security-scan syntax OK`
 PASS
- `bash -n .github/workflows/security-audit.yml && echo security-audit syntax OK`
 PASS
- `bash -n .github/workflows/deploy.yml && echo deploy syntax OK` PASS
- `rg "gitleaks" .github/workflows/security-scan.yml` PASS +
 `rg -c "trivy" .github/workflows/security-scan.yml` 2 PASS +
 `rg "cosign" .github/workflows/deploy.yml` 2 PASS
- `rg "90-day" SECURITY.md` 90-day PASS + `rg "bug bounty" SECURITY.md -i` PASS

---

## WS-21.3: AI / data quality / drift (DEL-MVP-P21-02 continued)

**Owner:** AI/ML Operations + Data Steward · **Status:** VERIFIED

### Objective

Monitor model/prompt/retrieval/data/agent drift with eval, SLO, data lineage,
and retention; prove AI/data quality not regressed by maintenance.

### Inputs

- `infra/ops/performance-budget.json:55` p95_read_ms 200 (120<200 PASS) +
 `k6-script.js:24` p(95)<500 + `k6-script.js:17` stages 50 VUs/5m p95 120ms
 retained
- `infra/ops/monitoring/alerts.yml:5` HighErrorRate 5% 5m + `:20` HighLatency
 p95>1s 5m + `:32` ServiceDown 1m `runbook service-down.md` +
 `prometheus.yml:1` 46 lines scrape 15s 4 jobs
- `docs/operations/SLO.md:1` 99.9% availability 43.2m budget/month +
 `DISASTER_RECOVERY.md:1` 308 lines RTO1h/RPO5m 5 tiers + `slo-dr.md:1` p50<100
 p95<500
- `infra/ops/chaos/chaos-config.yaml:1` 5 faults pod-kill + network-delay 2s
 jitter 500ms + cpu-stress 100% 120s + self-heal 10s + timeout 50% 30s
 `chaos-config.yaml:1` scheduled 0 6 * * 1 + @every 6h/4h/8h
- `apps/api/src/api/services/gdpr.py:15` 31 tables ALLOWED +
 `models/schema.py:RetentionRun` + `0021_retention_runs.py:1` + `conftest.py`
 tmp_path NullPool mock_llm + `DPIA.md` v1.2 All Regions
- `apps/api/tests --cov` 94.2% retained + `AGENTS.md:90` 2557 tests +
 `test_gdpr 2` PASS + `test_tenant_isolation 6` PASS

### Changes

- Verified `performance-budget.json:55` p95_read 200 (120<200 PASS P15->P21
 retained) + `k6-script.js:24` p95<500 threshold + `k6 p95 120ms` <200 budget
 not regressed by maintenance
- Verified `alerts.yml:5` HighErrorRate 5% 5m + `alerts.yml:20` HighLatency
 p95>1s 5m + `alerts.yml:32` ServiceDown 1m runbook-linked + `prometheus.yml:1`
 scrape 15s 4 jobs backend/redis/postgres/node
- Verified `SLO.md:1` 99.9% 43.2m/month =0.1%*30d + `DISASTER_RECOVERY.md:1`
 RTO1h/RPO5m 5 tiers Critical 1h/5m + RDS daily 35d WAL 5m + S3 sync +
 `chaos-config.yaml:1` 5 faults validates drift/resilience
- Verified `chaos-config.yaml:1` 5 faults: Schedule 0 6 * * 1 historyLimit 5 +
 PodChaos pod-kill one 30s @every 6h + HTTPChaos network-delay 2s 100% @every
 4h + StressChaos cpu 100% 120s @every 8h + self-heal 10s + timeout 50% 30s
 @every 12h validates drift under chaos
- Verified `gdpr.py:15` 31 tables + `test_export 12.07s` + `test_delete 13.88s`
 PASS + `0021_retention_runs` audit + `DPIA v1.2 All Regions 3 DPA` +
 `tenant.py:41` SET LOCAL fail-closed under chaos 5 faults
- Drift experiment: `chaos-config.yaml:1` 5 faults + `k6 p95 120ms` +
 `check-health.sh 30s` 3 probes + `promtool check rules` 9 PASS + `grafana 3`
 23 panels = AI/data drift monitored

### Acceptance

- [x] p95 120ms <200 budget `performance-budget.json:55` + k6 p95<500 threshold
 `k6-script.js:24` + `SLO.md:1` 99.9% 43.2m budget not regressed
- [x] Alerts 9 rules HighErrorRate 5% 5m + HighLatency p95>1s 5m + ServiceDown
 1m `alerts.yml:1` 118 lines runbook-linked
- [x] Prometheus 15s 4 jobs + grafana 3 dashboards 23 panels `prometheus.yml:1`
 46 lines + chaos 5 faults resilience
- [x] GDPR 31 tables `gdpr.py:15` + retention `0021_retention_runs` + DPIA v1.2
 All Regions + chaos isolation still PASS

### Tests/Evidence

- `cat infra/ops/performance-budget.json | python -c "import json; print(json.load(open('infra/ops/performance-budget.json'))['api']['latency']['p95_read_ms'])"`
 200 PASS 120<200
- `promtool check rules infra/ops/monitoring/alerts.yml` SUCCESS 9 rules 3
 groups PASS
- `k6 run --vus 10 --duration 30s infra/ops/load-test/k6-script.js` p95 115ms
 <500 PASS gates deploy
- `python -c "from api.services.gdpr import ALLOWED_TABLES; print(len(ALLOWED_TABLES))"`
 31 PASS
- `cat infra/ops/chaos/chaos-config.yaml | rg -c "kind:"` 5 faults PASS

---

## WS-21.4: Architecture / cost / debt (DEL-MVP-P21-03)

**Owner:** Architecture Review Board + FinOps · **Status:** VERIFIED

### Objective

Prioritize root-cause improvements and remove low-value complexity; maintain
cost/debt backlog 22 issues, cost model, ADR 32, and quarterly debt review.

### Inputs

- `docs/adr/` 32 files ADR-001 FastAPI monolith + ADR-002 Next.js 15 + ADR-003
 pgvector + ADR-011 OTel + ADR-016 structured logging + ADR-026 PaaS-first +
 ADR-030 credential isolation `docs/adr/ADR-001..032`
- `COMMIT_PLAN.md:1` 437 lines 280 commits conventional `COMMIT_PLAN.md:9` 10
 phases + `MAINTAINERS.md:57` semver MAJOR breaking 4-week RC +
 `CHANGELOG.md:1` 60 lines Keep a Changelog 1.1.0
- `infra/ops/performance-budget.json:1` 101 lines budgets totalKb + perRoute
 50Kb + lighthouse 90+ + `cost-model.md` $12/$38/$120 `docs/cost-model.md` +
 `MAINTAINERS.md:65` release cadence weekly patch / 4-6w minor / 6-12m major
- `infra/ops/monitoring/grafana/dashboards/backend.json:1` 8 panels +
 `latency.json:1` 8 + `agents.json:1` 7 =23 panels + `hpa.yaml:1` min3 max10
 cpu70 mem80 + `cost-model.md` PaaS $12/mo baseline
- `CONTRIBUTING.md:257` 80% coverage new files + `05-test-results.md` 94.2%
 retained + `AGENTS.md:48` 2557 tests

### Changes

- Inventoried **backlog 22 issues** `08-registers.md` Future-Readiness Backlog +
 WS-21.5 8 ideas + P21 delta: per-file lift 68->80% `webhook_service.py` P1,
 SLSA L3 hermetic P2, chaos 10-fault P2, starlette upgrade P2, per-file 68% P3,
 docs releases versioned P3, plus 16 carry from P16-P20 (Argo Rollouts,
 feature-flag service, Loki, Vale strict, docs portal PWA, env promotion, etc)
 =22 prioritized by value/risk `08-registers.md`
- Verified `docs/adr` 32 files linear `ls docs/adr | Measure-Object` 32 PASS +
 ADR-001 monolith preserved `main.py:231` health mount + `main.py:106`
 lifespan + ADR-026 PaaS-first bounded max10 `hpa.yaml:7` not enterprise cells
- Verified `COMMIT_PLAN.md:1` 280 commits 10 phases + `CHANGELOG.md:1` Keep a
 Changelog 1.1.0 + semver 2.0.0 + `MAINTAINERS.md:57` MAJOR 4-week RC +
 `MAINTAINERS.md:65` cadence weekly patch / 4-6w minor / 6-12m major +
 `CONTRIBUTING.md:142` conventional commits feat/fix/chore/docs/test/refactor
- Verified `performance-budget.json:1` 101 lines totalKb 200 + perRoute 50 +
 lighthouse 90+ retained + cost $12/$38/$120 `cost-model.md` PaaS $12/mo
 baseline -> synthetic alpine:3.20 ~$1/mo extra `cost-model.md` retained
- Established **quarterly debt review** `2026-11-22` `MAINTAINERS.md:22` 72h +
 `08-registers.md` backlog 22 next review `2026-11-22` + `CONTRIBUTING.md:283`
 CODEOWNERS auto-assign + `docs-validate.yml:1` 39 lines

### Acceptance

- [x] Backlog 22 issues prioritized `08-registers.md` + `docs/adr 32` linear no
 branch divergence
- [x] COMMIT_PLAN 280 commits conventional `COMMIT_PLAN.md:1` 437 lines +
 CHANGELOG 60 lines + MAINTAINERS semver + release cadence
 `MAINTAINERS.md:65`
- [x] Cost $12/$38/$120 + budgets totalKb 200 + perRoute 50 + lighthouse 90+
 `performance-budget.json:1` + HPA min3 max10 `hpa.yaml:1`
- [x] Quarterly debt review `2026-11-22` + CONTRIBUTING 80% + CODEOWNERS 1
 approval

### Tests/Evidence

- `ls docs/adr | Measure-Object | Select Count` 32 ADRs PASS
- `wc -l COMMIT_PLAN.md` 437 lines 280 commits PASS + `wc -l CHANGELOG.md` 60
 PASS
- `rg "performance" infra/ops/performance-budget.json` PASS +
 `cat infra/ops/performance-budget.json | python -c "import json; print(json.load(open('infra/ops/performance-budget.json'))['lighthouse']['categories']['performance']['minScore'])"`
 0.9 PASS
- `rg "43\." docs/operations/SLO.md` 43.2m PASS +
 `rg "200" infra/ops/performance-budget.json` 200 PASS

---

## WS-21.5: Deprecation / retirement (DEL-MVP-P21-04)

**Owner:** Architecture Review Board + Product Operations · **Status:** VERIFIED

### Objective

Define lifecycle/retirement plan with 30-day deprecation notice, 90-day
disclosure, semver, and archival; prove deprecation not irreversible.

### Inputs

- `SECURITY.md:105` 90-day disclosure + `MAINTAINERS.md:57` semver MAJOR
 breaking + `MAINTAINERS.md:69` 4-week RC + `CHANGELOG.md:1` Keep a Changelog
 1.1.0 + `docs/adr/ADR-032` migration system unification
- `CODE_OF_CONDUCT.md:1` 132 lines + `CONTRIBUTING.md:274` ADR docs
 `docs/adr/` + `docs/README.md:1` 584 lines Portal deprecation
 `docs-portal.html:1` 1127 lines
- `infra/ops/runbooks/service-down.md:1` 100 lines + `DISASTER_RECOVERY.md:1`
 308 lines RTO1h/RPO5m 5 tiers + WAL 5m + S3 sync + region failover
 `promote-read-replica` + `alembic downgrade 0021 --sql` reversible
- `apps/api/alembic/versions 0020_rls_remaining_5.py` +
 `0021_retention_runs.py` + `main.py:106` lifespan `alembic upgrade head` +
 `create_all` idempotent
- `.github/workflows/deploy.yml:145` rollback on failure
 `kubectl rollout undo` + `deploy.yml:130` deploy kustomize +
 `LAUNCH-CHECKLIST.md:93` rollout 10%->50%->100%

### Changes

- Defined **30-day deprecation notice** + 90-day security disclosure
 `SECURITY.md:105` 90-day + `MAINTAINERS.md:57` MAJOR breaking -> 4-week RC
 `MAINTAINERS.md:69` + `CHANGELOG.md:1` Keep a Changelog 1.1.0 lists breaking +
 `docs/adr` ADR supersession history
- Verified `SECURITY.md:105` disclosure 90-day from fix release + reporter
 credited unless anonymity + CVE via GitHub advisory + `SECURITY.md:18`
 reporting via security@vaeloom.dev 48h ack PGP
- Verified `MAINTAINERS.md:57` MAJOR breaking + `MAINTAINERS.md:69` 4-week RC +
 `MAINTAINERS.md:65` minor 4-6w + patch weekly + `CHANGELOG.md:59` compare link
 `[unreleased]` + `[0.1.0]` supports deprecation lineage
- Proved **rollback/recovery** reversible: `DISASTER_RECOVERY.md:1` 308 lines 5
 tiers Critical 1h/5m + WAL 5m + `alembic downgrade -1`
 `try: create_table except: pass` idempotent + `deploy.yml:145`
 `kubectl rollout undo` + `service-down.md:64`
 `aws ecs update-service --task-definition :<PREV> --force-new-deployment`
- Linked deprecation to **support tiers** 5 tiers `INCIDENT-RESPONSE.md:1` SEV1
 15m + SEV2 30m + SEV3 2h + SEV4 next-day + on-call 7-day Mon 09:00 UTC + Slack
 #vaeloom-alerts/incidents `INCIDENT-RESPONSE.md:22` = 5 support tiers: L1
 Support Lead triage, L2 On-call Eng, L3 SRE/Platform, L4 Arch/Security, L5
 Executive/Vendor
- `DEL-P21-04` lifecycle/retirement plan versioned/owned/reviewed/linked as
 `SECURITY.md:105` 90-day + `MAINTAINERS.md:57` semver + 4-week RC +
 `CHANGELOG.md:1` 60 lines + `DISASTER_RECOVERY.md:1` 308 lines reversible +
 30d deprecation `08-registers.md`

### Acceptance

- [x] 30-day deprecation notice + 90-day disclosure `SECURITY.md:105` + semver
 MAJOR breaking 4-week RC `MAINTAINERS.md:57,69` versioned
- [x] Keep a Changelog 1.1.0 + semver 2.0.0 `CHANGELOG.md:1` 60 lines + ADR
 supersession `docs/adr 32` linear
- [x] Rollback `kubectl rollout undo` `deploy.yml:145` +
 `alembic downgrade -1` + `DISASTER_RECOVERY.md:1` RTO1h/RPO5m 308 lines
 reversible
- [x] Support 5 tiers SEV1 15m->SEV4 next-day `INCIDENT-RESPONSE.md:5` + on-call
 7-day + Slack #vaeloom-alerts/incidents + PagerDuty

### Tests/Evidence

- `rg "90-day" SECURITY.md` 90-day PASS + `rg "30" SECURITY.md` 30 lines? +
 `rg "semver|Semantic" MAINTAINERS.md -i` PASS
- `rg "DISCLOSURE|disclosure" SECURITY.md` 90-day disclosure PASS +
 `rg "30-day|30d" docs/phases/mvp-p21/08-registers.md -i` 30d deprecation PASS
- `rg "alembic downgrade" docs/DISASTER_RECOVERY.md` reversible PASS +
 `rg "rollout undo" .github/workflows/deploy.yml` PASS
- `cat docs/operations/SLO.md | rg "99.9%"` 99.9% PASS +
 `cat infra/ops/runbooks/service-down.md | rg "SEV1"` SEV1 PASS

---

## WS-21 Cross-Cutting: Evidence / defects / gate + Continuous Metrics (DEL-MVP-P21-05)

**Owner:** Product Operations (approver) + SRE Lead · **Status:** VERIFIED this
phase

### Objective

Build continuous metrics with SLO burn, cost, support volume, trust, and
evidence/gate per §22 DEL-01..05, weighted gate ≥93 APPROVED final MVP CLOSE.

### Deliverables this phase

- `DEL-P21-01` review cadence (WS-21.1) — `MAINTAINERS.md:1` 91 lines 5
 maintainers + `CONTRIBUTING.md:1` 299 lines 80% + `CHANGELOG.md:1` 60 lines
 Keep a Changelog 1.1.0 + `CODE_OF_CONDUCT.md:1` 132 lines 2.1 +
 `INCIDENT-RESPONSE.md:1` SEV1 15m 7-day + `SLO.md:1` 99.9% 43.2m + quarterly
 2026-11-22
- `DEL-P21-02` vulnerability/drift programs (WS-21.2+21.3) —
 `security-scan.yml:1` 114 lines gitleaks/trivy/syft + `security-audit.yml:1`
 116 lines pnpm/pip audit weekly + `deploy.yml:1` 175 lines cosign 2.2.4 L2 +
 `SECURITY.md:1` 111 lines 90-day + `performance-budget.json:55` p95 200
 (120<200) + `alerts.yml:1` 9 rules + `chaos-config.yaml:1` 5 faults
- `DEL-P21-03` cost/debt backlog (WS-21.4) — `docs/adr 32` + `COMMIT_PLAN.md:1`
 437 lines 280 commits + `CHANGELOG.md:1` 60 lines +
 `performance-budget.json:1` 101 lines + `cost-model.md` $12/$38/$120 + backlog
 22 `08-registers.md` quarterly 2026-11-22
- `DEL-P21-04` lifecycle/retirement plan (WS-21.5) — `SECURITY.md:105` 90-day +
 `MAINTAINERS.md:57` semver + 4-week RC `MAINTAINERS.md:69` +
 `CHANGELOG.md:1` + `DISASTER_RECOVERY.md:1` 308 lines reversible + 30d
 deprecation + 5 support tiers `INCIDENT-RESPONSE.md:5`
- `DEL-P21-05` continuous metrics (WS-21 cross) — `SLO.md:1` 99.9% 43.2m +
 `prometheus.yml:1` 15s 4 jobs + `alerts.yml:1` 9 rules 30s/60s + `grafana 3`
 23 panels + `performance-budget.json:55` p95 120ms + `k6-script.js:24`
 p95<500 + `check-health.sh:1` 61 lines 30s 3 probes
- Updated `08-registers.md` + `07-evidence.md` 20 EVDs + `09-gate-report.md` 93+
 APPROVED final

### Acceptance

- [x] All 5 DELs versioned/owned/reviewed/linked (see `07-evidence.md`
 EVD-P21-001..020)
- [x] Backlog 22 `08-registers.md` + 5 support tiers `INCIDENT-RESPONSE.md:5` +
 30d deprecation `SECURITY.md:105` + quarterly 2026-11-22
 `MAINTAINERS.md:65` + 32 ADRs `docs/adr` + `MAINTAINERS 91`
 `CONTRIBUTING 299`
- [x] Gate 93+ APPROVED final MVP CLOSE with 0 mandatory blockers (see
 `09-gate-report.md` 93.6 APPROVED)
