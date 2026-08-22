# Vaeloom — Production Launch Checklist

## Pre-Launch (T-7 days)

### Environment & Configuration

- [ ] **Secret scanning** — verify no secrets committed via `git secrets` /
      `trufflehog`
- [ ] `.env.production` populated from `.env.production.template`, all values
      filled
- [ ] JWT_SECRET changed from default (>= 64 chars, cryptographically random)
- [ ] ENCRYPTION_KEY set (>= 32 chars, random)
- [ ] LLM_API_KEY set (Anthropic or OpenAI)
- [ ] STORAGE_ACCESS_KEY / STORAGE_SECRET_KEY set
- [ ] Database password changed from defaults
- [ ] Redis password set if using AUTH
- [ ] Rate limit Redis URL configured (`rate_limit_redis_url`)
- [ ] `SERVICE_ENVIRONMENT` = `production`
- [ ] **Queue worker deployed** (ADR-033): `queue-worker` service/compose task
      running `python -m api.workers.queue_worker` alongside the API — without
      it cron schedules execute inline (single-instance, no retry)
- [ ] `REDIS__URL` reachable from API + worker pods; daemon claims visible under
      `vaeloom:daemon:claim:*`
- [ ] Optional: `AGENT_REACT_ENABLED` explicitly set (`0` default) after
      reviewing ADR-033 cost/latency trade-off

### DNS & SSL

- [ ] Domain registered and Route53 hosted zone created
- [ ] ACM certificate issued for domain + `*.domain` in us-east-1 (for
      CloudFront)
- [ ] ACM certificate issued in target region (for ALB)
- [ ] DNSSEC enabled on Route53 hosted zone
- [ ] SPF, DKIM, DMARC records configured for mail domain

### Database

- [ ] RDS instance provisioned (Multi-AZ, automated backups enabled)
- [ ] Backup retention >= 7 days, preferred backup window set
- [ ] Migration `alembic upgrade head` run against production DB
- [ ] Migration verified idempotent (rolled back and re-applied in staging)
- [ ] Connection pooling (PgBouncer/RDS Proxy) configured
- [ ] Performance Insights enabled
- [ ] Deletion protection enabled

### Storage

- [ ] S3 bucket created with versioning enabled
- [ ] S3 bucket public access blocked, encryption (SSE-S3 or KMS) enabled
- [ ] S3 lifecycle policy for uploads (expire incomplete multipart uploads)
- [ ] CloudFront distribution created for static assets
- [ ] Origin access control (OAC) restricting S3 bucket to CloudFront only

### Monitoring & Observability

- [ ] OpenTelemetry collector deployed and receiving traces
- [ ] CloudWatch dashboards configured (RDS, ALB, ECS, Redis)
- [ ] Prometheus metrics endpoint (`/metrics`) accessible and scraped
- [ ] Sentry DSN configured for error tracking
- [ ] Synthetic health-check pings configured (every 60s)
- [ ] Log group retention set (30 days for app logs, 7 days for debug)
- [ ] Alert thresholds defined and tested

### Security

- [ ] WAF ACL attached to CloudFront + ALB (rate-based + SQLi/XSS rules)
- [ ] Security headers verified (HSTS, CSP, X-Frame-Options, etc.)
- [ ] CORS `allowed_origins` restricted to production domain only
- [ ] IAM roles with least-privilege policies deployed
- [ ] Backend `validate_settings()` passes on startup (checks JWT, keys)
- [ ] Plugin sandbox isolation verified
- [ ] Rate limiting enabled (10 req/s default, 50MB upload body limit)
- [ ] Infisical / external secret manager integrated (fallback to env)

### CI/CD

- [ ] CI pipeline green on production branch (`main`/`master`)
- [ ] CD pipeline green — container images pushed to ECR
- [ ] ECS task definitions updated with production resource limits
- [ ] Blue/green or rolling deployment strategy verified
- [ ] `pnpm install` produces identical `pnpm-lock.yaml` (frozen lockfile)
- [ ] Docker images scanned for critical CVEs (Trivy / Snyk)
- [ ] Backend tests pass: `cd apps/api && python -m pytest tests/ -q`

### Backup & Recovery

- [ ] RDS automated backup retention configured
- [ ] S3 cross-region replication enabled (if applicable)
- [ ] Terraform state backed up to S3 with DynamoDB locking
- [ ] Offline backup of encryption keys (KMS key material, PGP)
- [ ] Disaster recovery runbook documented
- [ ] Restore-from-backup drill completed in staging

---

## Launch Day

### Traffic Ramp-Up

- [ ] DNS TTL lowered to 60s before cutover
- [ ] CloudFront distribution status = Deployed
- [ ] Route53 alias record switched to ALB
- [ ] Initial traffic at 10% via weighted routing for 15 min
- [ ] Ramp to 50% for 30 min
- [ ] Ramp to 100% after all checks pass
- [ ] Old DNS TTL restored to 300s after cutover

### Monitoring (watch during ramp-up)

- [ ] ALB 5xx rate < 0.1%
- [ ] Backend p95 latency < 500ms for API calls
- [ ] RDS CPU < 30%, connections < 50% of max
- [ ] Redis memory usage < 60%
- [ ] ECS tasks stable (no restarts/crashes)
- [ ] Web (Next.js) response time < 200ms
- [ ] Error budget not consumed (SLO = 99.9%)
- [ ] No unexpected Sentry errors
- [ ] Rate limit counters not triggered on legitimate traffic

### Alerts & On-Call

- [ ] All alert channels tested (PagerDuty / Slack / email)
- [ ] On-call engineer confirmed and available
- [ ] Escalation path verified (primary → secondary → engineering lead)
- [ ] Incident response runbook printed/accessible
- [ ] `@vaeloom-status` Twitter/Mastodon account ready for comms

### Rollback Plan

- [ ] Previous ECS task revision tagged and deployable
- [ ] RDS point-in-time recovery (PITR) window verified
- [ ] CloudFront distribution has fallback origin
- [ ] `git revert` tested on staging for the release commit
- [ ] Rollback command documented: `make rollback-production`
- [ ] Rollback decision threshold: 5% error rate or >2 SEV2 incidents

### Communication

- [ ] Internal launch notification sent to team
- [ ] Status page updated (e.g. status.vaeloom.app)
- [ ] External launch announcement drafted and scheduled

---

## Post-Launch (T+1 to T+7 days)

### Performance Baseline

- [ ] p50 / p95 / p99 latency recorded for all critical endpoints
- [ ] Throughput baseline (RPS) established
- [ ] Database connection pool utilization recorded
- [ ] Memory and CPU profiles captured
- [ ] Cold-start times (if applicable) documented
- [ ] Lighthouse scores for web app recorded

### Error Budget

- [ ] 9-day rolling error budget calculated (SLO target: 99.9%)
- [ ] Error budget burn rate alert configured
- [ ] SEV1/SEV2/SEV3 incident counts logged
- [ ] Mean time to detect (MTTD) and mean time to resolve (MTTR) calculated

### User Feedback

- [ ] Feedback channels verified (in-app widget, email, support portal)
- [ ] First-week NPS survey sent
- [ ] Crash reporting data reviewed
- [ ] Feature adoption metrics tracked
- [ ] Support ticket volume monitored
- [ ] Known issues triaged into backlog

### Infrastructure Tuning

- [ ] Auto-scaling thresholds adjusted based on launch traffic
- [ ] RDS instance scaling evaluated (IOPS, connections)
- [ ] Redis memory-fragmentation ratio checked
- [ ] CDN cache hit ratio reviewed (>80% target)
- [ ] WAF tuning — false positive rate < 0.01%

### Documentation

- [ ] Launch postmortem scheduled (T+14)
- [ ] Runbooks updated with incident learnings
- [ ] Architecture diagram updated to reflect production topology
- [ ] Post-launch checklist archived for next release
