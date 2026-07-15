# Testing Strategy

> **Purpose:** Comprehensive testing strategy for Vaeloom â€” from unit tests to production monitoring
> **Status:** âœ… Upgraded to enterprise quality
> **Owner:** QA Team
> **Last Updated:** 2026-07-12
> **Canonical source:** [`/Docs/Vaeloom-Complete-Documentation.md#12-implementation-plan`](../../Docs/Vaeloom-Complete-Documentation.md#12-implementation-plan)

---

## Overview

Vaeloom's testing strategy follows a pyramid approach with the right balance of speed, confidence, and cost. The strategy covers traditional software testing (unit, integration, E2E) and AI-specific testing (golden datasets, adversarial tests, evaluation framework).

This document defines the testing philosophy, the types of tests, coverage targets, and how tests integrate with the CI/CD pipeline.

## Testing Pyramid

```mermaid
graph TB
    subgraph "Production Monitoring"
        PM[Canary Analysis<br/>Error Budgets<br/>SLO Monitoring]
    end
    
    subgraph "E2E Tests (5%)"
        E2E[Critical User Flows<br/>Playwright]
        Smoke[Smoke Tests<br/>Post-Deploy]
    end
    
    subgraph "Integration Tests (20%)"
        IT[API + Database<br/>Service Boundaries<br/>3rd Party Mocks]
        CT[Contract Tests<br/>Web â†” API]
    end
    
    subgraph "Unit Tests (75%)"
        UT[Functions<br/>Components<br/>Services<br/>Business Logic]
        PT[AI Prompts<br/>Golden Datasets]
    end
    
    style PM fill:#ff6
    style E2E fill:#f66
    style IT fill:#66f
    style UT fill:#6f6
```

## Test Types

| Test Type | Scope | Speed | Confidence | Tools | CI Stage |
|-----------|-------|-------|------------|-------|----------|
| **Unit** | Individual functions, components | < 100ms each | Low (isolated) | Jest, pytest, RTL | Every PR |
| **Golden** | AI prompt output correctness | < 5s each | Medium | Custom eval runner | Every prompt change |
| **Integration** | Service boundaries (API + DB) | < 10s each | Medium | Supertest, pytest-django | Every PR |
| **Contract** | Frontend â†” API interface | < 5s each | Medium | Pact | Every PR |
| **E2E** | Full user flows | < 60s each | High | Playwright | Staging deploy |
| **Smoke** | Critical endpoints post-deploy | < 30s total | High | curl + assertions | Every deploy |
| **Load** | System under expected load | < 30 min | High | k6 | Pre-release |
| **Security** | Vulnerability scanning | < 5 min | High | ZAP, Dependabot | Weekly |

## Testing by Phase

| Phase | Unit | Integration | E2E | AI Evals | Coverage Target |
|-------|------|-------------|-----|----------|-----------------|
| 0 â€” Infrastructure | âœ… | âœ… (health check) | âœ… (signup flow) | â€” | 60% |
| 1 â€” Ingestion | âœ… | âœ… (parser accuracy) | â€” | âœ… (golden files) | 80% |
| 2 â€” Organization Agent | âœ… | âœ… | âœ… (upload â†’ organize) | âœ… (proposal accuracy) | 80% |
| 3 â€” Resume & ATS | âœ… | âœ… | âœ… (resume â†’ ATS score) | âœ… (generation quality) | 85% |
| 4 â€” Career Intelligence | âœ… | âœ… | âœ… (search â†’ apply) | âœ… (ranking quality) | 85% |
| 5 â€” Communication | âœ… | âœ… | âœ… (Gmail â†’ schedule) | âœ… (classification) | 85% |
| 6 â€” Dashboard & Settings | âœ… | âœ… | âœ… (export â†’ delete) | â€” | 80% |
| 7 â€” Enterprise | âœ… | âœ… | âœ… (tenant isolation) | â€” | 90% |

## Unit Testing Standards

```typescript
// âœ… Good: Tests business logic in isolation
// apps/api/src/services/document.service.test.ts
describe('DocumentService', () => {
  let service: DocumentService;
  let mockRepo: jest.Mocked<DocumentRepository>;

  beforeEach(() => {
    mockRepo = {
      create: jest.fn(),
      findById: jest.fn(),
    };
    service = new DocumentService(mockRepo);
  });

  describe('deduplicateDocuments', () => {
    it('should return original if no duplicates found', async () => {
      mockRepo.findById.mockResolvedValue(null);
      
      const result = await service.deduplicateDocuments(
        ['doc_1', 'doc_2'],
        'ws_abc'
      );
      
      expect(result).toEqual({
        duplicates: [],
        original: ['doc_1', 'doc_2'],
      });
    });

    it('should flag content-similar documents as duplicates', async () => {
      mockRepo.findById
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'doc_2',
          contentHash: 'abc123',
        });
      
      const result = await service.deduplicateDocuments(
        ['doc_2', 'doc_3'],
        'ws_abc'
      );
      
      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0].reason).toBe('content_match');
    });

    it('should handle empty document lists', async () => {
      const result = await service.deduplicateDocuments([], 'ws_abc');
      expect(result.original).toEqual([]);
      expect(result.duplicates).toEqual([]);
    });
    
    it('should handle workspace_id mismatch', async () => {
      // This would be caught by Permission Engine, not DocumentService
      // Unit test should verify the service doesn't check permissions
    });
  });
});
```

## E2E Testing Standards

```typescript
// apps/web/e2e/document-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Document Upload and Organization', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@vaeloom.dev');
    await page.fill('[data-testid="password"]', 'test-password');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
  });

  test('user uploads resume and agent proposes organization', async ({ page }) => {
    // Upload document
    await page.goto('/workspace');
    await page.setInputFiles('[data-testid="file-dropzone"]', 'fixtures/resume.pdf');
    
    // Wait for processing
    await expect(page.locator('[data-testid="upload-progress"]')).toContainText('Processing');
    await page.waitForSelector('[data-testid="proposal-card"]', { timeout: 30000 });
    
    // Verify proposal
    await expect(page.locator('[data-testid="proposal-filename"]')).toContainText('Resume_2026');
    await expect(page.locator('[data-testid="proposal-folder"]')).toContainText('Career > Resume');
    
    // Approve
    await page.click('[data-testid="approve-button"]');
    
    // Verify in workspace
    await expect(page.locator('[data-testid="file-list"]')).toContainText('Resume_2026.pdf');
  });

  test('user can reject and edit proposal', async ({ page }) => {
    await page.goto('/workspace');
    await page.setInputFiles('[data-testid="file-dropzone"]', 'fixtures/certificate.pdf');
    
    await page.waitForSelector('[data-testid="proposal-card"]', { timeout: 30000 });
    
    // Edit proposal
    await page.click('[data-testid="edit-button"]');
    await page.fill('[data-testid="filename-input"]', 'AWS_Certificate.pdf');
    await page.click('[data-testid="save-button"]');
    
    // Verify custom name
    await expect(page.locator('[data-testid="file-list"]')).toContainText('AWS_Certificate.pdf');
  });
});
```

## AI Test Standards

```python
# apps/ai-service/tests/test_memory_agent.py
import pytest
from agents.memory_agent.handler import MemoryAgentHandler

class TestMemoryAgent:
    """Tests for the Memory Agent's entity extraction capabilities."""
    
    @pytest.fixture
    def handler(self):
        return MemoryAgentHandler()
    
    @pytest.mark.golden
    @pytest.mark.parametrize("document,expected_entities", [
        (
            {
                "content": "Education: B.Tech CSE, IIT Delhi, 2023-2027\n"
                          "Skills: Python, React, SQL\n"
                          "Projects: Built a ML model for fraud detection",
                "type": "resume"
            },
            {
                "skills": ["Python", "React", "SQL", "ML"],
                "organizations": ["IIT Delhi"],
                "projects": ["fraud detection ML model"],
                "education": [{"degree": "B.Tech CSE"}]
            }
        ),
        (
            {
                "content": "",
                "type": "resume"
            },
            {
                "skills": [],
                "organizations": [],
                "projects": [],
                "education": []
            }
        ),
        (
            {
                "content": "A" * 100000,  # Very long document
                "type": "other"
            },
            None  # Should not error, return whatever it can extract
        ),
    ])
    async def test_extract_entities(self, handler, document, expected_entities):
        """Verify entity extraction produces expected results."""
        result = await handler.extract_entities(document)
        
        if expected_entities is None:
            # Should not crash on edge cases
            assert result is not None
            return
        
        for skill in expected_entities["skills"]:
            assert skill in result["skills"], f"Missing skill: {skill}"
        
        assert len(result["skills"]) >= len(expected_entities["skills"])
```

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Test behavior, not implementation | Refactoring doesn't break tests |
| One assertion concept per test | Clear failure messages |
| Use factories, not fixtures | Flexible test data |
| Mock external services | Fast, reliable, no network dependency |
| Test edge cases explicitly | Empty inputs, null values, error states |
| Golden datasets versioned with prompts | Reproducible AI tests |

## Common Mistakes

| Mistake | Consequence | Fix |
|---------|-------------|-----|
| Testing implementation details | Tests break on refactoring | Test public API / behavior |
| Integration tests without test DB | Use production DB â†’ data pollution | Dedicated test database with transactions |
| Skipping AI eval tests | Prompt regression in production | Block deploys on eval failure |
| Flaky E2E tests | Ignored test failures | Retry flaky tests, fix root cause |
| No performance baseline | Can't detect regressions | Store historical performance data |

## Coverage Targets

| Module | Line Coverage | Branch Coverage | Notes |
|--------|--------------|----------------|-------|
| apps/web (components) | 80% | 70% | UI-heavy, lower target |
| apps/api (services) | 90% | 80% | Core business logic |
| ai-service (agents) | 90% | 80% | Critical AI logic |
| ai-service (retrieval) | 85% | 75% | RAG pipeline |
| Golden datasets | 95% accuracy | â€” | AI correctness |

## Performance Testing Considerations

| Concern | Mitigation |
|---------|------------|
| AI golden tests slow (5s+ each) | Run on prompt changes only, not every PR |
| E2E tests flaky | Retry 3x with exponential backoff |
| Load tests expensive | Run pre-release, not on every deploy |
| Visual regression tests | Run on staging, not in CI |

## Security Testing Considerations

| Concern | Mitigation |
|---------|------------|
| SAST false positives | Tune rules per project, manual review |
| Dependency alerts on test deps | Exclude dev dependencies from scanning |
| AI adversarial tests | Run on prompt changes, not every PR |
| Tenant isolation tests | Quarterly penetration testing, not automated |

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| AI model prompt injection in tests | Eval suites must include adversarial prompts designed to bypass guardrails â€” integrate these into the golden dataset and block deploys on critical failures |
| Test data containing real user PII | Golden datasets and test fixtures must use synthetic or anonymized data â€” scan test data for patterns resembling real user information before committing |
| SAST false positives masking real vulnerabilities | Tune static analysis rules per service to reduce noise, but maintain a manual triage process for all findings labeled critical or high |

## Performance Considerations

| Concern | Approach |
|---------|----------|
| AI golden test execution time | Running a full golden dataset evaluation on every commit can take 10+ minutes â€” run a smoke subset on PRs and the full suite nightly |
| E2E test suite duration | A growing E2E suite that takes >30 minutes blocks CI â€” parallelize test execution across multiple runners and prioritize critical user journeys |
| Integration test database overhead | Each integration test that creates and tears down database state adds 50-200ms â€” use transaction rollback tests that share a single connection for significant speedup |

## Goals

- Achieve 85% line coverage across all production code by end of Phase 5
- Block deployments on critical AI golden dataset failures to prevent prompt regressions
- Reduce flaky test rate to below 1% through systematic detection and quarantine
- Maintain CI pipeline under 15 minutes including all test stages
- Automate adversarial prompt testing for all AI agents against known injection patterns

## Scope

**In Scope:**
- Unit tests for individual functions, services, and components
- Integration tests for API + database service boundaries
- E2E tests for critical user flows (upload, organize, apply)
- AI golden dataset tests for prompt output correctness
- Contract tests for frontend to API interface
- Smoke tests for post-deployment verification
- Load tests for pre-release performance validation
- Security tests for vulnerability scanning

**Out of Scope:**
- Visual regression testing (manual review process)
- Manual exploratory testing (ad hoc, not automated)
- Performance testing in CI (run as separate pre-release stage)
- Third-party integration testing (mocked in CI)
- Accessibility compliance testing (future phase)

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | Every PR shall pass unit, integration, and golden tests before merge | Critical |
| FR-002 | AI golden dataset tests shall run on every prompt change | Critical |
| FR-003 | Smoke tests shall run on every deployment to staging and production | Critical |
| FR-004 | E2E tests shall run on every staging deployment | High |
| FR-005 | Load tests shall run before every production release | High |
| FR-006 | Contract tests shall detect API interface changes between frontend and backend | High |
| FR-007 | Coverage thresholds shall be enforced in CI per module | Medium |
| FR-008 | Flaky tests shall be automatically detected and quarantined | Medium |

## Non-Functional Requirements

| ID | Requirement | Target | Measurement |
|----|-------------|--------|-------------|
| NFR-001 | Full test suite (excluding load) shall complete within 15 minutes | < 15 min | CI pipeline test duration |
| NFR-002 | Unit tests shall complete within 100ms per test | < 100ms | Per-test execution time |
| NFR-003 | Integration tests shall complete within 10 seconds per test | < 10s | Per-test execution time |
| NFR-004 | E2E tests shall complete within 60 seconds per scenario | < 60s | Per-scenario execution time |
| NFR-005 | Golden dataset accuracy shall exceed 95% | > 95% | Per-dataset accuracy metric |
| NFR-006 | Flaky test rate shall remain below 1% | < 1% | Flaky rate over 7-day window |

## Components

| Component | Responsibility | Technology | Scale Strategy |
|-----------|---------------|------------|----------------|
| Unit Test Runner | Execute function and service-level tests | Jest (TS), pytest (Python) | Parallel worker processes, sharding |
| Integration Test Runner | Execute API + database boundary tests | Supertest, pytest-django | Service containers, parallel execution |
| E2E Test Runner | Execute full user flow tests | Playwright | Parallel browser contexts, multiple workers |
| Golden Dataset Evaluator | Validate AI prompt output against known samples | Custom eval framework | Parallel eval runs, cached model responses |
| Contract Test Runner | Validate API interface compatibility | Pact | Provider-side verification in CI |
| Load Test Runner | Execute performance benchmarks | k6 | Distributed cloud execution |
| Coverage Reporter | Aggregate and validate coverage metrics | Istanbul, pytest-cov, Codecov | Per-service coverage dashboard |

## Data Flow

1. **PR Submission** â€” Developer pushes code; CI triggers test pipeline; dependencies are restored from cache; test shards are allocated across parallel workers
2. **Unit Test Execution** â€” Jest and pytest run unit tests in parallel shards with mock external services; simple functions complete in <50ms; services with DB mocks complete in <200ms
3. **Integration Test Execution** â€” Integration tests spin up PostgreSQL and Redis service containers, run API requests against test endpoints, verify responses with schema assertions, and clean up test data via transaction rollback
4. **Golden Dataset Evaluation** â€” On prompt changes, custom evaluator runs agent prompts against predefined input/output pairs, compares results to expected outputs, and calculates accuracy metrics (must exceed 95% threshold)
5. **Coverage Aggregation** â€” All test results are collected; coverage reports are generated per module and uploaded to Codecov; coverage thresholds are validated against targets â€” pipeline fails if thresholds are not met

## Scalability

| Dimension | Current Limit | 10x Strategy | 100x Strategy |
|-----------|---------------|--------------|---------------|
| Test count | 500 tests | 5000 tests with parallel sharding | 50000 tests with distributed execution |
| E2E test count | 20 scenarios | 200 scenarios with parallel browsers | 2000 scenarios with cloud test grid |
| Golden dataset size | 50 prompts | 500 prompts with parallel eval | 5000 prompts with batch inference |
| CI concurrent runners | 4 runners | 16 runners with auto-scaling | 64 runners with self-hosted fleet |
| Coverage reporting | Per-service dashboard | Per-module with historical trends | Per-function with flaky attribution |

## Error Handling

| Error Scenario | Detection | Mitigation | Recovery |
|----------------|-----------|------------|----------|
| Flaky test detected | Test failed then passed on retry | Quarantine test, notify owner | Fix root cause, re-enable from quarantine |
| Golden dataset accuracy below threshold | Accuracy metric < 95% | Block deployment, alert AI team | Fix prompt, re-evaluate |
| Integration test DB setup failure | Service container startup timeout | Retry with clean container | Increase timeout, check resource limits |
| E2E test timeout | Playwright timeout > 60s | Retry with backoff (3 attempts) | Fix test or increase timeout for slow flow |
| Coverage below threshold | Coverage metric < target | Warning for small misses, block for > 5% | Add tests for uncovered paths |
| Load test target not met | Performance metric below SLA | Block release, generate perf report | Optimize bottleneck, re-run load test |

## Monitoring

| Metric | Alert Threshold | Severity | Dashboard |
|--------|----------------|----------|-----------|
| Test suite pass rate | < 95% over 1 hour | Critical | CI Test Health Dashboard |
| Flaky test count | > 5 active quarantined tests | Warning | Flaky Test Dashboard |
| Golden dataset accuracy | < 95% for any dataset | Critical | AI Eval Dashboard |
| Code coverage per module | Decrease > 2% from baseline | Warning | Coverage Trends Dashboard |
| E2E test duration p95 | > 90 seconds | Warning | E2E Performance Dashboard |
| CI pipeline duration | > 20 minutes for 3 consecutive runs | Warning | Pipeline Duration Dashboard |

## Configuration

| Variable | Purpose | Default | Required |
|----------|---------|---------|----------|
| COVERAGE_THRESHOLD_LINE | Minimum line coverage percentage | 80 | Yes |
| COVERAGE_THRESHOLD_BRANCH | Minimum branch coverage percentage | 70 | Yes |
| GOLDEN_ACCURACY_THRESHOLD | Minimum golden dataset accuracy | 0.95 | Yes |
| E2E_RETRY_COUNT | Number of retries for flaky E2E tests | 2 | No |
| E2E_TIMEOUT | E2E test timeout in milliseconds | 60000 | No |
| INTEGRATION_DB_URL | Test database connection string | postgresql://test:test@localhost:5432/test | Yes |
| FLAKY_QUARANTINE_WINDOW | Hours to quarantine flaky test | 48 | No |
| LOAD_TEST_RPS_TARGET | Target requests per second for load tests | 1000 | No |
| PARALLEL_WORKERS | Number of parallel test workers | 4 | No |

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Golden dataset stale and not reflecting real user inputs | Medium | High | Monthly review of datasets against production data patterns |
| E2E tests creating test data pollution in staging | Medium | Medium | Dedicated test workspace, cleanup after test suite |
| Flaky tests eroding trust in CI pipeline | Medium | High | Automatic quarantine system, mandatory root cause analysis |
| AI eval tests being too expensive to run on every commit | High | Medium | Run smoke eval on PR, full eval nightly |
| Coverage targets encouraging useless tests | Medium | Low | Coverage as indicator, not target; code review for test quality |

## Limitations

| Limitation | Impact | Workaround | Future Resolution |
|------------|--------|------------|-------------------|
| No visual regression testing | UI regressions may go undetected | Manual review of staging UI | Add Percy or Chromatic for automated visual diff |
| Golden datasets limited to known patterns | Unknown edge cases untested | Manual exploratory testing | Generate synthetic edge cases via LLM |
| Load tests not run in CI | Performance regressions caught late | Pre-release gate with mandatory load test | Run performance smoke tests in CI, full suite nightly |
| No fuzz testing for agent inputs | Prompt injection may slip through | Manual adversarial testing | Automated fuzz testing with known injection patterns |
| No test impact analysis | All tests run on every commit | Manual test selection | Test impact analysis based on changed files |

## Future Improvements

| Improvement | Priority | Complexity | Timeline |
|-------------|----------|------------|----------|
| Test impact analysis for selective test execution | High | High | Q4 2026 |
| Automated visual regression testing (Percy/Chromatic) | High | Medium | Q3 2026 |
| Automated fuzz testing for agent prompt injection | Medium | Medium | Q3 2026 |
| Performance smoke tests in CI | Medium | Low | Q2 2026 |
| Synthetic edge case generation for golden datasets | Low | Medium | Q4 2026 |

## Examples

### Unit test with mocked dependencies

```typescript
describe('DocumentService', () => {
  let service: DocumentService;
  let mockRepo: jest.Mocked<DocumentRepository>;

  beforeEach(() => {
    mockRepo = { create: jest.fn(), findById: jest.fn() };
    service = new DocumentService(mockRepo);
  });

  it('should return original if no duplicates', async () => {
    mockRepo.findById.mockResolvedValue(null);
    const result = await service.deduplicateDocuments(['doc_1'], 'ws_abc');
    expect(result.duplicates).toEqual([]);
  });
});
```

### E2E test for proposal flow

```typescript
test('user uploads and approves agent proposal', async ({ page }) => {
  await page.goto('/workspace');
  await page.setInputFiles('[data-testid="file-dropzone"]', 'fixtures/resume.pdf');
  await page.waitForSelector('[data-testid="proposal-card"]', { timeout: 30000 });
  await expect(page.locator('[data-testid="proposal-filename"]')).toContainText('Resume');
  await page.click('[data-testid="approve-button"]');
  await expect(page.locator('[data-testid="file-list"]')).toContainText('Resume_2026.pdf');
});
```

### AI golden dataset test

```python
@pytest.mark.golden
@pytest.mark.parametrize("document,expected", [
    ({"content": "Python, React, SQL", "type": "resume"}, ["Python", "React", "SQL"]),
    ({"content": "", "type": "resume"}, []),
])
async def test_skill_extraction(handler, document, expected):
    result = await handler.extract_entities(document)
    for skill in expected:
        assert skill in result["skills"]
```

### Integration test with Pact contract

```typescript
describe('Web â†’ API contract', () => {
  it('should return proposals', async () => {
    await provider
      .given('proposals exist')
      .uponReceiving('a GET request for proposals')
      .withRequest({ method: 'GET', path: '/v1/proposals' })
      .willRespondWith({ status: 200, body: { proposals: [] } });
    await provider.verify();
  });
});
```

---

## Related Documents

- [Unit Testing.md](./Unit-Testing.md)
- [Integration Testing.md](./Integration-Testing.md)
- [E2E Testing.md](./E2E-Testing.md)
- [AI Testing.md](./AI-Testing.md)
- [`DevOps/CI-CD.md`](../DevOps/CI-CD.md)
