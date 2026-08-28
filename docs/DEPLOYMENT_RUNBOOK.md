# Vaeloom Deployment Runbook

This runbook covers the full deployment pipeline from code commit to production
release.

## Pre-Deployment Checklist

- [ ] All CI checks passing (lint, typecheck, tests, security scan)
- [ ] CHANGELOG.md updated with release notes
- [ ] Version bumped in `apps/api/pyproject.toml` and `apps/web/package.json`
- [ ] Database migrations reviewed and tested against a staging copy of
 production data
- [ ] Change log reviewed by at least one other engineer
- [ ] Environment variables for production updated in Infisical
- [ ] No unresolved security advisories (`pnpm audit`, `pip-audit`)
- [ ] Load test results within acceptable thresholds (p99 latency < 2s, error
 rate < 0.1%)

## Build and Push Docker Images

```bash
# Tag the release
export VERSION=$(git describe --tags --abbrev=0)
git tag -a "v$VERSION" -m "Release v$VERSION"
git push origin "v$VERSION"

# Backend image
docker build -t $ECR_REGISTRY/vaeloom-api:$VERSION ./apps/api
docker tag $ECR_REGISTRY/vaeloom-api:$VERSION $ECR_REGISTRY/vaeloom-api:latest
docker push $ECR_REGISTRY/vaeloom-api:$VERSION
docker push $ECR_REGISTRY/vaeloom-api:latest

# Frontend image
docker build -t $ECR_REGISTRY/vaeloom-web:$VERSION ./apps/web
docker tag $ECR_REGISTRY/vaeloom-web:$VERSION $ECR_REGISTRY/vaeloom-web:latest
docker push $ECR_REGISTRY/vaeloom-web:$VERSION
docker push $ECR_REGISTRY/vaeloom-web:latest
```

## Terraform Apply

```bash
cd infra/terraform/environments/$ENV
terraform init -backend-config="key=$ENV/terraform.tfstate"
terraform plan -out=tfplan
terraform apply tfplan
```

**Environments**: `dev`, `staging`, `prod` — each has a separate state file in
S3.

## Database Migrations

Migrations run automatically at backend startup (`alembic upgrade head`). For
manual execution:

```bash
kubectl exec -it deployment/vaeloom-api -- alembic upgrade head

# Rollback (last change):
kubectl exec -it deployment/vaeloom-api -- alembic downgrade -1

# Check current migration version:
kubectl exec -it deployment/vaeloom-api -- alembic current
```

**WARNING:** Rollback of destructive migrations (column drops, table drops)
causes data loss. Prefer creating a new migration that adds the column/table
back.

## Deploy to Staging

Staging deploys automatically on merge to `main` via GitHub Actions
(`.github/workflows/deploy-staging.yml`).

Manual trigger:

```bash
# Update Kubernetes manifests
cd infra/kubernetes
kustomize edit set image $ECR_REGISTRY/vaeloom-api:$VERSION
kustomize edit set image $ECR_REGISTRY/vaeloom-web:$VERSION

# Apply to staging
kubectl config use-context vaeloom-staging
kustomize build overlays/staging | kubectl apply -f -

# Watch rollout
kubectl rollout status deployment/vaeloom-api -n vaeloom --timeout=5m
kubectl rollout status deployment/vaeloom-web -n vaeloom --timeout=5m
```

## Smoke Tests

After staging deploy, run smoke tests:

```bash
# Health checks
curl -f https://staging.vaeloom.dev/health
curl -f https://staging.vaeloom.dev/health/ready

# Auth flow
TOKEN=$(curl -s -X POST https://staging.vaeloom.dev/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@vaeloom.dev","password":"test1234"}' | jq -r '.access_token')
echo "Token: ${TOKEN:0:20}..."

# Core API test
curl -s -H "Authorization: Bearer $TOKEN" \
  https://staging.vaeloom.dev/api/v1/workspaces | jq '. | length'

# E2E tests (Playwright)
cd apps/web && pnpm exec playwright test --grep "@smoke"

# Load test snippet
cd testing/load && k6 run --vus 10 --duration 30s smoke-test.js
```

## Deploy to Production

```bash
# 1. Switch context
kubectl config use-context vaeloom-prod

# 2. Apply updated manifests
cd infra/kubernetes
kustomize build overlays/prod | kubectl apply -f -

# 3. Rolling update
kubectl set image deployment/vaeloom-api -n vaeloom \
  backend=$ECR_REGISTRY/vaeloom-api:$VERSION
kubectl set image deployment/vaeloom-web -n vaeloom \
  web=$ECR_REGISTRY/vaeloom-web:$VERSION

# 4. Monitor rollout
kubectl rollout status deployment/vaeloom-api -n vaeloom --timeout=10m
kubectl rollout status deployment/vaeloom-web -n vaeloom --timeout=10m

# 5. Verify production health
curl -f https://api.vaeloom.dev/health
curl -f https://app.vaeloom.dev/api/health

# 6. Run production smoke tests
cd testing && python smoke_tests.py --env production
```

## Rollback Procedure

### Immediate Rollback (last deploy)

```bash
# Rollback backend
kubectl rollout undo deployment/vaeloom-api -n vaeloom
kubectl rollout status deployment/vaeloom-api -n vaeloom --timeout=5m

# Rollback frontend
kubectl rollout undo deployment/vaeloom-web -n vaeloom
kubectl rollout status deployment/vaeloom-web -n vaeloom --timeout=5m

# Verify rollback
curl -f https://api.vaeloom.dev/health
```

### Rollback to Specific Version

```bash
kubectl rollout undo deployment/vaeloom-api -n vaeloom --to-revision=3
kubectl rollout undo deployment/vaeloom-web -n vaeloom --to-revision=3
```

### Database Rollback

```bash
# If the deploy included a migration that needs reverting:
kubectl exec -it deployment/vaeloom-api -- alembic downgrade -1

# If data was corrupted, restore from backup:
# see DISASTER_RECOVERY.md
```

### Post-Rollback

1. Confirm the rollback resolved the issue
2. Create a GitHub issue describing what went wrong
3. If production is blocked, consider reverting the PR and deploying a clean
 version
4. Notify stakeholders via the incident channel

## Monitoring Post-Deploy

- **Health checks**: every 30s (CloudWatch) - alert on 2 consecutive failures
- **Error rate**: >1% 5xx responses over 5 minutes → PagerDuty alert
- **Latency**: p99 > 3s over 5 minutes → PagerDuty alert
- **LLM API errors**: >5% LLM call failures over 5 minutes → Slack alert
- **Database connections**: >80% of max_connections → CloudWatch alarm
- **Pod restarts**: any pod restart in production → investigation ticket
 auto-created

## Deployment Windows

| Environment | Window | Approval |
| ----------- | ------------------------ | ------------------------------ |
| Dev | Any time | Self-service |
| Staging | Mon-Fri, 08:00-20:00 UTC | CI green |
| Production | Mon-Thu, 09:00-16:00 UTC | 2 approvals + on-call notified |

**No production deployments on Fridays or before public holidays.**
