# WAF Runbook (AWS WAFv2, CloudFront scope)

> **Module:** `infra/terraform/modules/waf/` · **Attached:** CloudFront
> (`infra/terraform/main.tf` → `module.cloudfront.waf_acl_arn`). **Last
> verified:** 2026-09-23.

## 1. Rule stack (priority order)

| Priority | Rule                       | What it does                                                                         | Tuning                                                                                        |
| -------- | -------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| 0        | `auth-brute-force-shield`  | Per-IP rate cap (`var.auth_rate_limit`, default 100/5min) scoped to `/api/v1/auth/*` | Lower to 20 if credential-stuffing alerts fire; legitimate users rarely exceed 10 logins/5min |
| 1        | `rate-limit`               | Global per-IP cap (`var.rate_limit`, default 2000/5min)                              | Raise before load tests; k6 runs need an exclusion or a higher limit                          |
| 2        | `sql-injection-protection` | `AWSManagedRulesSQLiRuleSet`                                                         | —                                                                                             |
| 3        | `xss-protection`           | `AWSManagedRulesXssRuleSet`                                                          | —                                                                                             |
| 4        | `common-exploits`          | `AWSManagedRulesCommonRuleSet`                                                       | —                                                                                             |
| 5        | `known-bad-inputs`         | `AWSManagedRulesKnownBadInputsRuleSet` (scanners, bad bots)                          | —                                                                                             |
| 6        | `ip-blocklist`             | `aws_wafv2_ip_set` from `var.ip_blocklist`                                           | Add attacker IPs here for instant blocks (no deploy of app needed)                            |

All rules `block` (not count) with per-rule CloudWatch metrics
(`vaeloom-<env>-*`) + sampled requests. Default action: allow.

## 2. Defense in depth (why WAF is layer 3, not layer 1)

1. **App middleware** (`rate_limit.py` + Redis, `auth.py`, `ip_filter.py`) —
   always on, even without AWS.
2. **WAF** (this doc) — edge filtering, brute-force shield, managed signatures.
3. **RLS + service policies** — data-layer isolation.

A WAF outage or misconfig never disables layer 1: the app enforces its own
limits. Conversely the app's fail-open-on-Redis-outage path (see
`rate_limit.py:_backend_degraded`, metric `rate_limit_degraded_total`) is
covered at the edge by rules 0–1 while Redis recovers.

## 3. Logging

CLOUDFRONT scope accepts **only Kinesis Firehose** destinations — a
CloudWatch/SNS ARN fails at apply (fixed 2026-09-23; previously wired to the
alert topic ARN). Set `waf_log_bucket_arn` (S3) to enable delivery to
`s3://<bucket>/waf/<env>/`. Empty (default) = no logging configuration. Query
with Athena (`waf_logs` table) or forward to the SIEM.

## 4. False-positive procedure

1. Identify the rule in CloudWatch (`vaeloom-<env>-<rule>` metric spike) or
   sampled requests.
2. For managed-rule false positives: add a **scope-down exclusion** (not a rule
   deletion) — narrow `byte_match` on the exact path + `count` action override
   for that label, following the `auth-brute-force-shield` pattern.
3. Verify with `terraform plan`, apply, watch the metric for 30 min.
4. Record the exclusion in the CHANGELOG entry for the deploy.

## 5. Pre-deploy checklist

- [ ] `terraform fmt -check infra/terraform/modules/waf`
- [ ] `terraform validate` (needs `terraform init`; CI runs it in `deploy.yml`)
- [ ] `ip_blocklist` current (remove stale entries older than 90d)
- [ ] `auth_rate_limit` appropriate for expected signup/login volume
- [ ] `waf_log_bucket_arn` set in prod (empty = flying blind)
