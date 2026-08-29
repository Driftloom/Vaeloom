# Test Failures — 2026-08-22

22 test failures found. All are real failures, not flaky.

## failures by module

### tests/middleware/test_csrf.py (4 failures)

CSRF middleware skip/403 logic broken. The CSRF protection for auth endpoints
may not be functioning correctly.

### tests/test_iam.py (13 failures)

All 13 IAM tests return 401 Unauthorized. The IAM endpoints are not properly
wired with authentication bypass or the test fixtures are not setting up auth
context correctly.

### tests/test_analytics.py (1 failure)

SQLAlchemy driver issue — likely a missing async driver or connection string
problem in the test fixture.

### tests/test_knowledge_graph.py (1 failure)

Knowledge graph traversal logic broken — possibly a graph query or path-finding
issue.

### tests/test_main.py (2 failures)

Request context middleware broken — likely correlation ID or tenant context not
being set in test requests.

## recommendation

These 22 failures block MVP-P13 (Security, Privacy, Compliance) and all
subsequent phases. Fix order:

1. **test_iam.py (13)** — highest impact, likely a fixture/wiring issue
2. **test_csrf.py (4)** — security-critical
3. **test_main.py (2)** — foundational middleware
4. **test_analytics.py (1)** — driver issue
5. **test_knowledge_graph.py (1)** — logic issue
