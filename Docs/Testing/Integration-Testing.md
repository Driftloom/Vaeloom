# Integration Testing

> **Purpose:** Define integration testing standards for Meridian
> **Status:** 🆕 New

## Integration Test Architecture

```mermaid
graph TD
    classDef test fill:#e3f2fd,stroke:#1565c0,color:#000,stroke-width:2px
    classDef infra fill:#e8f5e9,stroke:#2e7d32,color:#000,stroke-width:1.5px
    classDef data fill:#fff3e0,stroke:#e65100,color:#000,stroke-width:1.5px

    subgraph Tests["🧪 Integration Test Scenarios"]
        direction TB
        T1["API → Database<br/>CRUD operations<br/>PostgreSQL test instance"]
        T2["API → AI Service<br/>Agent request routing<br/>Real agent, mocked LLM"]
        T3["API → Redis<br/>Queue + cache<br/>Redis test instance"]
        T4["AI → Database<br/>Memory read/write<br/>PostgreSQL test instance"]
        T5["Web → API<br/>Frontend-backend contract<br/>Pact contract testing"]
    end

    subgraph Infra["⚙️ Test Infrastructure"]
        I1["postgres-test<br/>postgis/postgis:16<br/>tmpfs (in-memory)"]
        I2["redis-test<br/>redis:7-alpine<br/>No persistence"]
        I3["api-test<br/>npm run test:integration<br/>Depends on PG + Redis"]
    end

    subgraph Strategy["📊 Test Data Strategy"]
        D1["Seed Data<br/>Migration files<br/>Per test class"]
        D2["Test-specific<br/>Factory functions<br/>Per test (tx rollback)"]
        D3["Golden Datasets<br/>JSON fixtures<br/>Read-only"]
    end

    T1 & T2 & T3 & T4 & T5 --> I1 & I2 & I3
    T1 & T2 & T3 & T4 & T5 --> D1 & D2 & D3

    class T1,T2,T3,T4,T5 test
    class I1,I2,I3 infra
    class D1,D2,D3 data
```

> **Diagram:** Integration tests cover 5 service boundary scenarios (API→DB, API→AI, API→Redis, AI→DB, Web→API). Each test runs against **dedicated test infrastructure** with in-memory PostgreSQL and ephemeral Redis. The **test data strategy** uses three tiers: seed data (migrations), test-specific (factories), and golden datasets (JSON fixtures).

---

## Integration Test Scope

Integration tests verify that services work correctly together:

| Test | Services Involved | What It Verifies |
|------|------------------|-----------------|
| API → Database | apps/api + PostgreSQL | CRUD operations |
| API → AI Service | apps/api + ai-service | Agent request routing |
| API → Redis | apps/api + Redis | Queue and cache |
| AI → Database | ai-service + PostgreSQL | Memory read/write |
| Web → API | apps/web + apps/api | Frontend-backend contract |

## Test Infrastructure

```yaml
# docker-compose.test.yml
services:
  postgres-test:
    image: postgis/postgis:16
    environment:
      POSTGRES_DB: meridian_test
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    tmpfs: /var/lib/postgresql/data  # In-memory for speed

  redis-test:
    image: redis:7-alpine
    command: redis-server --appendonly no  # No persistence for tests

  api-test:
    build: ./apps/api
    environment:
      DATABASE_URL: postgresql://test:test@postgres-test:5432/meridian_test
      REDIS_URL: redis://redis-test:6379
    depends_on: [postgres-test, redis-test]
    command: npm run test:integration
```

## Integration Test Example

```typescript
describe('Document Integration', () => {
  beforeAll(async () => {
    // Start test containers
    await setupTestInfrastructure();
    // Run migrations
    await runMigrations();
  });

  afterAll(async () => {
    await teardownTestInfrastructure();
  });

  it('should upload and retrieve a document', async () => {
    const response = await request(app)
      .post('/api/v1/documents')
      .attach('file', 'test-data/resume.pdf')
      .set('Authorization', `Bearer ${testToken}`);
    
    expect(response.status).toBe(201);
    expect(response.body.document.name).toBe('resume.pdf');

    // Verify it's in the database
    const getResponse = await request(app)
      .get(`/api/v1/documents/${response.body.document.id}`)
      .set('Authorization', `Bearer ${testToken}`);
    
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.document.id).toBe(response.body.document.id);
  });
});
```

## Test Data Strategy

| Data Type | Source | Isolation |
|-----------|--------|-----------|
| Seed data | Migration files | Per test class |
| Test-specific | Factory functions | Per test (transaction rollback) |
| Golden datasets | JSON fixtures | Read-only |

## Common Mistakes

| Mistake | Consequence |
|---------|-------------|
| Using production-like data without isolation | Test data leaks between test runs, causing flaky failures |
| Not resetting state between test cases | Tests become order-dependent and unreliable |
| Mocking the service under test's dependencies incorrectly | False confidence — tests pass but real integration fails |

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Use dedicated test databases with transaction rollback | Clean state per test, fast execution |
| Test service boundaries explicitly | Verify each external dependency integration independently |
| Use contract tests for frontend-backend boundaries | Catch API contract changes before E2E failures |

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| Test databases may use weaker credentials | Match production security policies in test environments |
| Integration tests expose network topology | Run tests in isolated VPC or Docker network |
| Mocked auth services skip actual token validation | Add dedicated security integration tests with real token checks |

## Performance Considerations

| Concern | Mitigation |
|---------|------------|
| Integration tests are slower than unit tests | Run critical integration tests on PR, extended tests nightly |
| Test containers (Postgres, Redis) add startup time | Keep containers warm between test runs in CI |
| In-memory databases may not reflect production performance | Use production-like instance types for performance-critical integration tests |

## Workflows

1. **API → Database integration test**: Test container starts PostgreSQL (in-memory tmpfs) → migration runs → test seeds data → test sends HTTP request to API → API queries test database → response verified against expectations → transaction rolled back → clean state for next test
2. **API → AI Service integration test**: Test spins up API service + mocked LLM endpoint → test sends document to API → API routes to AI service agent → agent calls mocked LLM → structured response returned → API returns enhanced document → verify extraction accuracy
3. **Web → API contract test (Pact)**: Frontend team defines expected API contract → Pact file generated → API team runs provider verification against Pact → if contract broken, CI fails with diff → teams coordinate on API change
4. **AI → Database memory integration**: Test creates memory entities via AI service → service writes to PostgreSQL → test reads back from database → verifies entity graph structure → cleans up test data

## Scalability

| Dimension | Current Limit | 10x Strategy | 100x Strategy |
|-----------|---------------|--------------|---------------|
| Concurrent integration test containers | 2 (postgres + redis) | 5 containers (add mock LLM, S3, Elasticsearch) | Kubernetes-based ephemeral test environments per PR |
| Integration test runtime | 5 min (50 tests) | 15 min (500 tests with parallel sharding) | 30 min (5000 tests with distributed execution) |
| Contract test (Pact) pacts | 5 | 50 pacts with automated compatibility verification | 500+ pacts with consumer-driven contract evolution |
| Test data factories | 10 | 50 factory functions with composition | Auto-generated factories from database schema |

## Error Handling

| Scenario | Detection | Mitigation | Recovery |
|----------|-----------|------------|----------|
| Test container fails to start | Docker compose returns non-zero | Retry container startup (3 attempts); log docker logs | If persistent, mark test environment as degraded; alert DevOps |
| Database migration fails during test | Migration script throws error | Rollback to previous migration; print error with line number | Fix migration script; rebuild test container |
| Pact contract verification fails | Provider endpoint doesn't match consumer expectation | CI fails with detailed diff of expected vs actual response | Update provider or notify consumer of breaking change |
| Mock LLM returns unexpected format | AI service test assertion fails | Log both expected and actual response; retry with increased timeout | Update mock to match LLM provider response format |

## Monitoring

| Metric | Alert Threshold | Severity | Dashboard |
|--------|----------------|----------|-----------|
| Integration test pass rate | < 98% | Critical | Grafana — Test Dashboard |
| Container startup time | > 30s | Warning | CI Pipeline — Integration Setup |
| Pact contract verification failures | > 0 per PR | Critical | GitHub Checks — Pact Report |
| Test data isolation violations | > 1 per test run | Warning | CI Pipeline — Test Logs |

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Integration tests become flaky due to container environment | Medium | High | Use deterministic tmpfs databases; pin container image versions |
| Test container image drift from production | Medium | High | Use same base images as production; periodic image rebuild |
| Pact contract tests not updated when API changes | High | Medium | Enforce pact verification in CI; break CI on contract mismatch |
| In-memory test database doesn't reflect production performance | Low | Medium | Add dedicated performance integration tests with production-like instance types |

## Limitations

| Limitation | Impact | Workaround | Future Resolution |
|------------|--------|------------|-------------------|
| In-memory databases behave differently from production (no disk I/O, no replication lag) | Performance characteristics differ | Test separately with production-like databases for performance-critical tests | Ephemeral production-replica environments for integration tests |
| Mock LLM cannot replicate production model behavior | AI integration tests may pass while production fails | Use golden datasets validated against real LLM output | Shadow-mode LLM testing with traffic mirroring |
| Test containers consume significant CI resources | High memory usage limits parallel runs | Use resource-efficient Alpine-based images; limit concurrent test containers | Dedicated test infrastructure pool with auto-scaling |

## Overview

Integration tests at Meridian verify that services work correctly together across their defined boundaries. Five integration scenarios are tested: API to Database (CRUD operations with PostgreSQL), API to AI Service (agent request routing with mocked LLM), API to Redis (queue publishing and cache operations), AI Service to Database (memory entity read/write), and Web to API (frontend-backend contract via Pact).

Each integration test runs against dedicated test infrastructure — PostgreSQL on tmpfs for in-memory speed, ephemeral Redis without persistence, and mocked external services. This infrastructure is defined in a `docker-compose.test.yml` that CI spins up before the test run and tears down after, ensuring clean state every time.

For Meridian's AI-driven workflows, the API-to-AI-Service integration test is critical. It verifies that the API correctly routes documents to the appropriate AI agent, that the agent processes the request (with a mocked LLM to avoid non-determinism and API costs), and that the structured response is correctly returned to the caller. This test catches routing errors, schema mismatches, and timeout misconfigurations that unit tests would miss.

Contract tests (Pact) between the web frontend and API serve as an early warning system for breaking API changes. The frontend team defines the expected API contract as a Pact file; the API team runs provider verification against this contract in CI. If a PR changes the API in a way that breaks the frontend's expectations, CI fails with a detailed diff of the contract mismatch.

## Goals

- Achieve 98%+ integration test pass rate on every PR
- Complete integration test suite (50+ tests) in under 5 minutes
- Detect and block any breaking API contract changes before they reach staging
- Maintain zero cross-test data contamination through transaction rollback isolation
- Start up test containers in under 10 seconds for fast local development

## Scope

### In Scope
- Five integration scenarios: API→DB, API→AI Service, API→Redis, AI→DB, Web→API (Pact contract)
- Dedicated test infrastructure: PostgreSQL on tmpfs, ephemeral Redis, mocked external services
- Transaction rollback for per-test database state isolation
- Pact contract testing between web frontend and API with CI provider verification
- Three-tier test data: seed data (migration files), test-specific (factory functions with transaction rollback), golden datasets (read-only JSON fixtures)

### Out of Scope
- Ephemeral production-replica test environments per PR (future improvement)
- Shadow-mode AI integration testing with traffic mirroring (future improvement)
- Automated contract test generation from API schemas (future improvement)
- Integration test impact analysis for selective execution (future improvement)

## Sequence Diagrams

```mermaid
sequenceDiagram
    participant DEV as Developer
    participant CI as CI Pipeline
    participant DC as Docker Compose
    participant PG as PostgreSQL (tmpfs)
    participant API as apps/api
    participant AI as ai-service

    DEV->>CI: Push PR
    CI->>DC: docker compose -f docker-compose.test.yml up
    DC->>PG: Start PostgreSQL (tmpfs, in-memory)
    DC->>PG: Start Redis (ephemeral, no persist)
    PG-->>DC: Services ready
    DC-->>CI: Infrastructure ready
    CI->>API: Run integration tests
    API->>PG: Run migrations
    API->>API: Seed test data
    API->>API: Send HTTP request
    API->>PG: Query test database
    PG-->>API: Response
    API->>AI: Route to agent (mocked LLM)
    AI-->>API: Structured response
    API-->>CI: Verify response against expectations
    CI->>PG: Transaction rollback (clean state)
    CI-->>DEV: Test results
```

---

| Improvement | Priority | Complexity | Timeline |
|-------------|----------|------------|----------|
| Ephemeral production-replica test environments per PR | High | High | Q4 2027 |
| Shadow-mode AI integration testing with traffic mirroring | High | High | Q3 2027 |
| Automated contract test generation from API schemas | Medium | Medium | Q2 2027 |
| Integration test impact analysis — only run affected tests | Medium | High | Q2 2027 |

## Examples

### API to database integration test

```typescript
describe('Document Integration', () => {
  beforeAll(async () => {
    await setupTestInfrastructure();
    await runMigrations();
  });
  afterAll(async () => await teardownTestInfrastructure());

  it('should upload and retrieve a document', async () => {
    const response = await request(app)
      .post('/api/v1/documents')
      .attach('file', 'test-data/resume.pdf')
      .set('Authorization', `Bearer ${testToken}`);

    expect(response.status).toBe(201);
    const getResponse = await request(app)
      .get(`/api/v1/documents/${response.body.document.id}`)
      .set('Authorization', `Bearer ${testToken}`);
    expect(getResponse.status).toBe(200);
  });
});
```

### Pact contract test (consumer side)

```typescript
describe('Web to API contract', () => {
  it('should return proposals list', async () => {
    await provider
      .given('workspace exists with proposals')
      .uponReceiving('a request for proposals')
      .withRequest({ method: 'GET', path: '/v1/workspaces/ws_abc/proposals' })
      .willRespondWith({ status: 200, body: { proposals: [] } });
    await provider.verify();
  });
});
```

### AI service integration test

```python
import pytest
from agents.memory_agent.handler import MemoryAgentHandler

class TestMemoryAgent:
    @pytest.fixture
    def handler(self):
        return MemoryAgentHandler()

    @pytest.mark.asyncio
    async def test_extract_entities(self, handler):
        document = {"content": "Skills: Python, React", "type": "resume"}
        result = await handler.extract_entities(document)
        assert "Python" in result["skills"]
        assert "React" in result["skills"]
```

### Docker compose test setup

```yaml
services:
  postgres-test:
    image: postgis/postgis:16
    tmpfs: /var/lib/postgresql/data
  api-test:
    build: ./apps/api
    depends_on: [postgres-test]
    command: npm run test:integration
```

---

## Related Documents

- [Unit Testing.md](./Unit-Testing.md)
- [E2E Testing.md](./E2E-Testing.md)
- [Testing Strategy.md](./Testing-Strategy.md)
