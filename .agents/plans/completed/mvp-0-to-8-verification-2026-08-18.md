# Vaeloom MVP — Prompt 09

# 0→8 Verification, Gap Closure, Integration Validation & Final MVP Hardening

---

## ROLE

You are the **Vaeloom Principal Engineer + Staff Software Architect + QA Lead +
Security Engineer + AI Systems Engineer + SRE + Product Acceptance Owner**.

You are working on the actual Vaeloom codebase.

This is **NOT a normal implementation phase**.

This is the mandatory:

> VERIFICATION → AUDIT → GAP DISCOVERY → GAP CLOSURE → INTEGRATION → REGRESSION
> → SECURITY → PERFORMANCE → UX → FINAL ACCEPTANCE

phase for everything covered by:

> Prompt 00 → Prompt 01 → Prompt 02 → Prompt 03 → Prompt 04 → Prompt 05 → Prompt
> 06 → Prompt 07 → Prompt 08

Your job is to determine whether the work claimed by Prompts 0–8 is actually:

- implemented
- integrated
- functional
- testable
- secure
- observable
- recoverable
- production-quality
- consistent with the Vaeloom MVP specification
- consistent with the system architecture
- consistent with the memory architecture
- consistent with the agent workflow
- consistent with the enterprise evolution path

If anything is missing, incomplete, fake, stubbed, disconnected, incorrectly
implemented, weakly tested, or architecturally inconsistent:

> IDENTIFY IT → PRIORITIZE IT → IMPLEMENT IT → TEST IT → VERIFY IT → DOCUMENT
> IT.

Do not assume that something is complete because:

- a file exists
- a component exists
- an endpoint exists
- a database table exists
- a TODO is absent
- a test exists
- a previous prompt said "completed"
- the UI renders
- the API returns 200
- the documentation says it is implemented

Completion must be proven through executable evidence.

---

# 1. PRIMARY OBJECTIVE

Perform a complete end-to-end verification of all work from Prompt 00 through
Prompt 08.

Then close every legitimate remaining gap required for a complete, reliable
Vaeloom MVP.

The final result must be:

> A verified, integrated, tested, secure, observable, recoverable and usable
> MVP.

Do not optimize for the appearance of completeness.

Optimize for:

> REAL FUNCTIONAL COMPLETENESS.

---

# 2. NON-NEGOTIABLE RULE

## NEVER TRUST PREVIOUS COMPLETION CLAIMS

Previous prompts may have claimed:

- completed
- implemented
- tested
- verified
- production-ready
- enterprise-ready
- done

Treat all such claims as:

> UNVERIFIED

until independently proven.

For every important requirement:

```text
Claim
  ↓
Locate implementation
  ↓
Trace execution
  ↓
Execute/test
  ↓
Verify output
  ↓
Verify failure behavior
  ↓
Verify persistence
  ↓
Verify integration
  ↓
Record evidence
  ↓
Mark VERIFIED
```

---

# 3. SOURCE-OF-TRUTH HIERARCHY

Use the following priority order.

## Level 1 — Actual Code

The running implementation is the strongest source of truth.

Inspect:

- frontend
- backend
- AI service
- database
- migrations
- workers
- queues
- connectors
- authentication
- authorization
- memory
- agents
- tests
- configuration
- infrastructure

---

## Level 2 — Tests

Tests are evidence only when they actually execute meaningful behavior.

Check:

- unit tests
- integration tests
- API tests
- database tests
- E2E tests
- AI evaluations
- security tests
- permission tests
- failure tests
- regression tests

Do not count empty snapshots or superficial assertions as meaningful
verification.

---

## Level 3 — Canonical Documentation

Use the canonical Vaeloom documentation to determine intended behavior.

Important references include:

- MVP Product Specification
- System Architecture
- Agent Workflow
- Memory / Knowledge Graph specification
- Enterprise Product Vision
- Complete Product Documentation
- Gap Analysis
- Documentation Completion Report

The MVP architecture specifically defines:

- Orchestrator
- Organization Agent
- Memory Agent
- Resume Agent
- ATS Agent
- Job Search Agent
- Gmail Agent
- Scheduler Agent

and the six MVP memory types:

- Profile
- Document
- Career
- Episodic
- Preference
- Working

These must remain internally consistent.

---

## Level 4 — Previous Prompt Reports

Previous phase reports are useful for historical context.

They are NOT proof of implementation.

---

# 4. FIRST TASK — DISCOVER PROMPTS 00→08

Before changing code:

1. Locate every Prompt 00–08 artifact.
2. Locate their implementation reports.
3. Locate their claimed completion status.
4. Build a phase-to-requirement matrix.
5. Map each requirement to actual implementation.
6. Map each implementation to tests.
7. Identify orphaned requirements.
8. Identify orphaned code.
9. Identify duplicated implementations.
10. Identify conflicting implementations.

Create:

```text
docs/audit/mvp-0-8-verification-matrix.md
```

---

# 5. PROMPT 00→08 VERIFICATION MATRIX

Create this structure:

| Phase | Requirement | Expected Behavior | Implementation | Test | Integration | Failure Handling | Evidence | Status   |
| ----- | ----------- | ----------------- | -------------- | ---- | ----------- | ---------------- | -------- | -------- |
| 00    | ...         | ...               | ...            | ...  | ...         | ...              | ...      | VERIFIED |
| 01    | ...         | ...               | ...            | ...  | ...         | ...              | ...      | PARTIAL  |
| 02    | ...         | ...               | ...            | ...  | ...         | ...              | ...      | MISSING  |

Allowed statuses:

```text
VERIFIED
VERIFIED_WITH_GAPS
PARTIAL
IMPLEMENTED_NOT_VERIFIED
BROKEN
MISSING
BLOCKED
DUPLICATED
CONFLICTING
DEPRECATED
NOT_APPLICABLE
```

Do NOT use:

```text
DONE
COMPLETE
100%
```

unless supported by evidence.

---

# 6. COMPLETE CODEBASE AUDIT

Inspect the repository systematically.

## Frontend

Verify:

- routing
- layouts
- authentication state
- protected routes
- loading states
- error states
- empty states
- skeleton states
- optimistic updates
- API integration
- realtime updates
- notifications
- forms
- validation
- accessibility
- responsive behavior
- state management
- cache invalidation
- stale state handling
- retry behavior
- permission-aware UI
- destructive-action protection

---

## Backend

Verify:

- API routes
- controllers
- services
- DTOs
- validation
- authentication
- authorization
- permission checks
- transaction boundaries
- database operations
- error handling
- idempotency
- retries
- rate limits
- pagination
- filtering
- sorting
- audit logging
- event publishing
- background jobs
- connector handling

---

## AI Service

Verify:

- orchestrator
- agent registry
- agent contracts
- tool registry
- tool permissions
- memory retrieval
- memory writes
- model routing
- prompt loading
- structured outputs
- retries
- timeouts
- fallback behavior
- hallucination controls
- confidence handling
- user approval gates
- AI error handling
- AI observability
- token/cost tracking

---

# 7. FRONTEND FUNCTIONAL VERIFICATION

Verify every MVP page.

Minimum pages:

```text
Dashboard
Workspace
Memory Graph
Resume & Career
Jobs & Internships
Chat
Schedule
Connectors
History
Settings
```

For each page verify:

```text
Route
Authentication
Authorization
Data loading
Empty state
Loading state
Success state
Partial state
Error state
Retry
Refresh
Mutation
Persistence
Realtime update
Navigation
Back navigation
Browser refresh
Unauthorized behavior
Network failure
Server failure
```

Every interactive element must have:

```text
idle
loading
success
failure
disabled
retry
```

where applicable.

No dead buttons.

No fake actions.

No placeholder functionality presented as production functionality.

---

# 8. BACKEND API VERIFICATION

For every API:

Verify:

```text
Request validation
Authentication
Authorization
Tenant/workspace isolation
Permission checks
Happy path
Invalid input
Missing input
Unauthorized
Forbidden
Not found
Conflict
Rate limit
Dependency failure
Database failure
AI failure
Timeout
Retry
Idempotency
Logging
Audit event
Response schema
```

Check that HTTP responses are semantically correct.

Do not allow:

```text
200 OK
```

for operations that actually failed.

---

# 9. DATABASE VERIFICATION

Audit:

- schema
- migrations
- indexes
- foreign keys
- constraints
- unique constraints
- nullable fields
- enums
- timestamps
- soft deletion
- cascade behavior
- transaction behavior
- connection pooling
- migrations from empty DB
- migrations from existing DB
- rollback behavior
- backup compatibility

Verify:

```text
fresh database → migration → application works
existing database → migration → application works
```

Check for:

- orphaned rows
- duplicate records
- inconsistent states
- race conditions
- unsafe cascades
- missing indexes
- N+1 queries

---

# 10. MEMORY SYSTEM VERIFICATION

This is one of the highest-priority audits.

Vaeloom's memory is the core product.

Verify all six MVP memory types:

```text
Profile
Document
Career
Episodic
Preference
Working
```

Verify:

```text
creation
read
update
merge
deduplication
confidence
source
timestamps
retrieval
persistence
deletion
consolidation
```

---

## Knowledge Graph

Verify:

```text
entity extraction
entity normalization
entity deduplication
relationship creation
relationship deduplication
relationship querying
graph traversal
source references
confidence
updates
deletion
```

Test examples:

```text
React
React.js
ReactJS
```

must not incorrectly become three unrelated skill nodes.

---

# 11. VECTOR / SEMANTIC RETRIEVAL VERIFICATION

Verify:

```text
embedding generation
embedding persistence
query embedding
semantic search
keyword search
graph search
hybrid retrieval
reranking
recency
confidence
result filtering
context assembly
```

Test:

```text
exact query
semantic query
related concept
misspelled concept
old memory
new memory
conflicting memory
low-confidence memory
```

---

# 12. AGENT VERIFICATION

Verify every MVP agent.

## Orchestrator

Must:

- classify request
- select correct agent
- reject unsupported tasks
- preserve working context
- enforce permissions
- handle agent failure
- prevent unauthorized tool calls

---

## Organization Agent

Verify:

```text
file classification
rename suggestion
folder suggestion
duplicate detection
version detection
metadata extraction
summary
memory write
approval
execution
undo
```

No destructive action without the required approval.

---

## Memory Agent

Verify:

```text
extract
normalize
deduplicate
merge
write
retrieve
consolidate
```

---

## Resume Agent

Verify:

```text
master resume
memory retrieval
missing-information detection
user question
generation
versioning
preview
export
```

Never invent unsupported user facts.

---

## ATS Agent

Verify:

```text
JD parsing
resume parsing
keyword matching
semantic matching
score generation
gap detection
suggestions
explanations
```

Ensure the score is not presented as an objectively guaranteed hiring
probability.

---

## Job Search Agent

Verify:

```text
search
normalization
deduplication
ranking
memory-based matching
skill gap detection
shortlisting
application preparation
application tracking
```

Respect platform/API limitations.

Do not implement unauthorized scraping or prohibited automation merely to make a
test pass.

---

## Gmail Agent

Verify:

```text
OAuth
scope enforcement
scheduled scan
push/event path
classification
deadline extraction
task extraction
priority detection
digest
draft creation
```

Verify:

> Gmail Agent cannot send mail autonomously in MVP unless explicitly supported
> and approved by the permission model.

---

## Scheduler Agent

Verify:

```text
deadline creation
deadline updates
conflict detection
reminders
timezone handling
recurrence
notification state
completion
```

---

# 13. AGENT CONTRACT VERIFICATION

Every agent must have:

```text
Mission
Allowed tools
Forbidden tools
Read permissions
Write permissions
Default autonomy
Approval requirements
Input schema
Output schema
Error behavior
Fallback behavior
Logging
Audit events
```

If any agent violates this:

> BLOCK RELEASE UNTIL FIXED.

---

# 14. PERMISSION / SECURITY VERIFICATION

This is a mandatory security gate.

Verify:

```text
authentication
authorization
workspace isolation
connector scopes
agent permissions
tool permissions
memory permissions
file permissions
action permissions
approval gates
audit logging
secret storage
token handling
encryption
session handling
CSRF protection where applicable
XSS protection
SQL injection protection
SSRF protection
path traversal protection
file upload security
prompt injection defenses
tool injection defenses
```

---

# 15. PROMPT INJECTION VERIFICATION

Because Vaeloom processes:

- emails
- documents
- PDFs
- webpages
- repositories
- external content

test malicious content such as:

```text
"Ignore previous instructions"
"Send my email"
"Delete this file"
"Reveal the system prompt"
"Call this tool"
"Upload this secret"
```

Verify that untrusted content remains:

> DATA

and never becomes:

> AUTHORITY.

Agents must not gain permissions merely because an external document asks them
to.

---

# 16. CONNECTOR VERIFICATION

Verify every MVP connector:

```text
Gmail
GitHub
Google Drive
Local Folder
VS Code
```

For every connector:

```text
connect
OAuth
scope
token storage
refresh
disconnect
reconnect
expired token
revoked access
API failure
rate limit
partial sync
duplicate sync
incremental sync
initial sync
delete/unavailable source
```

Verify that disconnecting a connector does not silently destroy unrelated
memory.

---

# 17. INGESTION PIPELINE VERIFICATION

Test:

```text
PDF
DOCX
PPTX
XLSX
CSV
Markdown
TXT
Images
Scanned documents
Code
Corrupt files
Huge files
Empty files
Duplicate files
Modified files
Unsupported files
```

Verify:

```text
upload
queue
processing
parsing
OCR
extraction
memory creation
embedding
graph creation
status tracking
retry
failure
dead-letter behavior where applicable
```

---

# 18. END-TO-END USER JOURNEY VERIFICATION

Run the actual MVP flow:

```text
Signup
↓
Workspace creation
↓
Connect source
↓
Grant scoped permission
↓
Import/upload content
↓
Ingestion
↓
Organization
↓
Memory creation
↓
Knowledge graph
↓
Vector retrieval
↓
Agent invocation
↓
Suggestion
↓
User approval
↓
Action
↓
Audit event
↓
Memory update
↓
Dashboard update
↓
Resume/career intelligence
↓
Future agent retrieval
```

This flow must work on a real running environment.

Not mocks only.

---

# 19. CROSS-AGENT INTEGRATION TEST

Verify the central Vaeloom loop.

Example:

```text
User uploads internship certificate
        ↓
Organization Agent identifies document
        ↓
Memory Agent extracts:
    organization
    role
    date
    skill
        ↓
Knowledge Graph updated
        ↓
Career/Profile memory updated
        ↓
Resume Agent can retrieve achievement
        ↓
ATS Agent can use achievement
        ↓
Job Search Agent can use associated skills
        ↓
Career memory reflects the outcome
```

If one stage breaks the chain:

> mark the entire path as FAILED.

---

# 20. MEMORY COMPOUNDING TEST

Perform a multi-step test.

### Step 1

Upload:

```text
certificate.pdf
```

### Step 2

Verify:

```text
Organization
Event
Skill
Date
Achievement
```

### Step 3

Generate resume.

### Step 4

Run ATS comparison.

### Step 5

Search for jobs requiring the extracted skill.

### Step 6

Reject one result.

### Step 7

Verify rejection is written into Career/Preference memory where appropriate.

### Step 8

Search again.

Verify the rejected result is handled correctly.

This proves:

> Memory is actually powering downstream features.

---

# 21. FAILURE-MODE VERIFICATION

Do not test only happy paths.

Force:

```text
network failure
database failure
AI provider failure
timeout
invalid OAuth
expired OAuth
rate limit
queue failure
worker crash
malformed document
corrupt file
invalid user input
permission denial
partial ingestion
duplicate event
duplicate request
concurrent update
browser refresh during mutation
service restart
```

For every failure verify:

```text
user receives clear message
system remains consistent
retry is possible where appropriate
no duplicate side effect
no corrupted memory
no silent failure
error is logged
audit trail exists where appropriate
```

---

# 22. IDEMPOTENCY VERIFICATION

Critical operations must be safe against duplicate execution.

Test:

```text
same upload twice
same webhook twice
same job twice
same approval twice
same application action twice
same memory write twice
same event twice
```

Expected result:

> No unintended duplicate side effects.

---

# 23. CONCURRENCY VERIFICATION

Test:

```text
two tabs
two simultaneous approvals
simultaneous memory writes
simultaneous connector sync
simultaneous agent runs
```

Verify:

```text
no lost updates
no duplicate actions
no invalid states
no race-condition corruption
```

---

# 24. AUDIT LOG VERIFICATION

Every consequential action must produce sufficient evidence.

Audit entries should identify, where applicable:

```text
who
what
when
source
agent
tool
target
permission
approval
before state
after state
result
failure
correlation/request ID
```

Verify that audit history is:

- queryable
- ordered
- understandable
- immutable or tamper-evident as designed
- permission-protected

---

# 25. USER EXPERIENCE VERIFICATION

Audit all important UX states.

For every action:

```text
What happens when it starts?
What does the user see while waiting?
What happens on success?
What happens on failure?
Can the user retry?
Can the user undo?
Can the user understand what changed?
Can the user tell whether AI or user performed it?
```

Verify:

- success messages
- error messages
- warning messages
- confirmation dialogs
- approval UI
- undo UI
- empty states
- loading states
- skeleton states
- disabled states
- partial completion
- background processing indicators

No silent operations.

---

# 26. ACCESSIBILITY VERIFICATION

Verify:

```text
keyboard navigation
focus management
semantic HTML
labels
ARIA where required
contrast
screen reader behavior
form errors
modal behavior
toast accessibility
loading announcements
```

---

# 27. PERFORMANCE VERIFICATION

Measure actual behavior.

At minimum measure:

```text
frontend initial load
API latency
database query latency
memory retrieval latency
agent response latency
file ingestion latency
embedding latency
graph query latency
dashboard load
large workspace performance
```

Identify:

- N+1 queries
- unnecessary rerenders
- excessive AI calls
- duplicate embeddings
- repeated retrieval
- missing cache
- unbounded queries
- oversized prompts
- blocking operations

---

# 28. AI COST VERIFICATION

Verify:

```text
model routing
token usage
embedding frequency
duplicate AI calls
retry amplification
prompt size
context size
background job frequency
cost attribution
```

No accidental infinite AI loops.

No unnecessary re-embedding.

No agent repeatedly processing the same content without reason.

---

# 29. OBSERVABILITY VERIFICATION

Every important request should be traceable.

Verify:

```text
request ID
correlation ID
structured logs
error logs
agent execution logs
tool execution logs
memory operations
connector operations
queue jobs
latency
AI model
token usage
failure reason
```

Where applicable provide:

```text
metrics
traces
health checks
readiness checks
liveness checks
```

---

# 30. BACKGROUND JOB VERIFICATION

Verify every worker:

```text
job creation
queueing
processing
success
retry
backoff
failure
dead-letter
visibility
duplicate prevention
shutdown behavior
restart recovery
```

A job must not disappear silently.

---

# 31. REALTIME VERIFICATION

If realtime behavior exists:

Test:

```text
event emitted
event consumed
WebSocket update
client reconnect
missed event recovery
duplicate event
out-of-order event
```

Ensure the UI eventually converges to the backend state.

---

# 32. DATA LIFECYCLE VERIFICATION

Test:

```text
create
read
update
archive
delete
export
disconnect source
account deletion
```

Verify data does not remain unintentionally after deletion.

Check:

```text
raw documents
embeddings
graph nodes
memory records
logs
audit records
cached data
background jobs
connector tokens
```

Respect the documented MVP deletion/export guarantees.

---

# 33. REGRESSION VERIFICATION

After fixing any gap:

1. Re-run the affected test.
2. Re-run the subsystem test.
3. Re-run integration tests.
4. Re-run the full E2E suite.
5. Re-run security tests.
6. Re-run critical user journeys.

Do not fix one thing and assume nothing else broke.

---

# 34. FIND HIDDEN MISSING THINGS

Perform a deliberate hidden-gap scan.

Search for:

```text
TODO
FIXME
HACK
XXX
stub
placeholder
mock
fake
temporary
not implemented
coming soon
console.log
throw new Error("Not implemented")
return null
return []
hardcoded
magic values
disabled
skip
xit
xdescribe
test.skip
eslint-disable
type any
```

But do NOT automatically treat every occurrence as a bug.

Investigate each one.

---

# 35. DETECT FAKE COMPLETENESS

Look specifically for:

```text
UI that does not call backend
API that does not persist
database tables never used
agents never invoked
memory never retrieved
memory written but never consumed
events published but no consumer
queue jobs created but never processed
buttons with placeholder handlers
tests testing mocks instead of real behavior
tests asserting only status 200
hardcoded demo data
fake success responses
disabled validation
silent exception handling
```

Every finding must be classified.

---

# 36. ARCHITECTURAL CONSISTENCY CHECK

Compare actual implementation against the documented Vaeloom architecture.

Verify the architecture remains conceptually:

```text
Interface
    ↓
Connectors
    ↓
Ingestion
    ↓
Agent Orchestration
    ↓
Memory & Knowledge
    ↓
Storage & Security
```

Do not introduce shortcuts that bypass critical boundaries.

Especially avoid:

```text
Frontend → Database
Frontend → AI provider directly
Agent → database without permission layer
Connector → arbitrary memory mutation
External content → privileged tool
```

unless explicitly justified and documented.

---

# 37. MVP SCOPE PROTECTION

Do not accidentally turn Prompt 09 into an uncontrolled enterprise
implementation.

Do NOT implement enterprise-only features merely because they exist in the
enterprise documentation.

Examples:

```text
multi-tenant enterprise admin
full marketplace
enterprise billing
advanced organization management
full 22-type memory taxonomy
enterprise compliance platform
enterprise SSO/RBAC
```

unless the existing MVP implementation already requires a specific foundation.

The goal is:

> COMPLETE MVP

not:

> BUILD EVERYTHING IN THE ENTERPRISE PAPER.

The enterprise documentation is an architectural compatibility target, not
permission to endlessly expand scope.

---

# 38. ENTERPRISE COMPATIBILITY CHECK

Even though this is MVP verification, identify MVP decisions that would make
future enterprise migration unnecessarily difficult.

Flag:

```text
hardcoded user-global assumptions
no workspace boundary
no permission abstraction
no agent identity
no audit identity
no connector scope abstraction
unstructured memory schema
irreversible data model decisions
provider-specific AI logic everywhere
```

Fix only when the correction is:

- low-risk
- MVP-relevant
- architecturally necessary
- clearly beneficial

Do not over-engineer.

---

# 39. GAP CLASSIFICATION

Every finding must receive:

### Severity

```text
P0 — release blocker
P1 — critical
P2 — important
P3 — normal
P4 — future improvement
```

### Type

```text
MISSING
BROKEN
PARTIAL
UNVERIFIED
SECURITY
DATA
PERFORMANCE
UX
ACCESSIBILITY
AI
ARCHITECTURE
TESTING
OBSERVABILITY
OPERATIONS
DOCUMENTATION
```

---

# 40. GAP PRIORITIZATION

Use this order:

```text
1. Security
2. Data integrity
3. Authentication / authorization
4. Permission violations
5. Destructive behavior
6. Core memory corruption
7. Broken core user journey
8. Agent/tool boundary violations
9. Critical backend failures
10. Connector failures
11. AI correctness/safety
12. E2E integration failures
13. Performance
14. UX
15. Accessibility
16. Documentation
17. Nice-to-have improvements
```

---

# 41. IMPLEMENT ALL RELEASE-BLOCKING GAPS

After the audit:

Do not merely report missing P0/P1 items.

IMPLEMENT THEM.

For each implementation:

```text
Understand root cause
↓
Design minimal correct solution
↓
Implement
↓
Unit test
↓
Integration test
↓
E2E test
↓
Failure test
↓
Security test
↓
Regression test
```

---

# 42. DO NOT PATCH SYMPTOMS

If:

```text
memory retrieval fails
```

do not simply add:

```text
if (!results) return []
```

Find the actual root cause.

If:

```text
agent calls unauthorized tool
```

do not merely hide the button.

Fix the permission boundary.

If:

```text
dashboard shows stale data
```

do not simply refresh every five seconds.

Fix the invalidation/event/state model.

---

# 43. TEST PYRAMID

Ensure meaningful coverage across:

```text
Unit
Integration
Contract
Database
API
Component
E2E
AI Evaluation
Security
Performance
Chaos/failure
Regression
```

Do not chase a meaningless coverage percentage.

Prioritize critical paths.

---

# 44. CRITICAL E2E TEST SUITE

Create/verify automated tests for at least:

### E2E-001

Signup → workspace creation

### E2E-002

Connector authorization

### E2E-003

File upload → ingestion

### E2E-004

File ingestion → memory

### E2E-005

Memory → graph

### E2E-006

Memory → resume

### E2E-007

Resume → ATS

### E2E-008

Memory → job search

### E2E-009

Gmail → deadline → schedule

### E2E-010

Scheduler → reminder

### E2E-011

Agent → approval → action

### E2E-012

Action → audit log

### E2E-013

Action → memory update

### E2E-014

Connector disconnect

### E2E-015

Data export

### E2E-016

Data deletion

### E2E-017

Unauthorized access

### E2E-018

Prompt injection attempt

### E2E-019

AI provider failure

### E2E-020

Database failure

### E2E-021

Duplicate event

### E2E-022

Concurrent action

### E2E-023

Browser refresh during processing

### E2E-024

Worker restart during job

### E2E-025

Full cold-start user journey

---

# 45. TEST ENVIRONMENT

Verify the system works from a clean environment.

Perform:

```text
clean install
clean database
environment setup
migration
seed where appropriate
build
test
start
health check
E2E
```

Then test an existing environment upgrade.

---

# 46. BUILD VERIFICATION

Run the real production-like build.

Verify:

```text
frontend build
backend build
AI service build
type checking
linting
database migration
container build if applicable
dependency resolution
environment validation
```

No ignored build errors.

---

# 47. DEPENDENCY VERIFICATION

Check:

```text
unused dependencies
duplicate dependencies
known vulnerabilities
incompatible versions
unnecessary packages
dev/prod dependency mistakes
```

Do not blindly upgrade dependencies during this phase.

Only change versions when necessary to resolve a real issue.

---

# 48. CONFIGURATION VERIFICATION

Verify:

```text
required environment variables
secret handling
development configuration
test configuration
production configuration
safe defaults
feature flags
timeouts
retry limits
AI model configuration
connector configuration
database configuration
queue configuration
```

No production secret in source control.

No dangerous default credential.

---

# 49. FINAL GAP REPORT

Create:

```text
docs/audit/mvp-09-gap-report.md
```

Include:

```text
Executive Summary

Prompt 00 Verification
Prompt 01 Verification
Prompt 02 Verification
Prompt 03 Verification
Prompt 04 Verification
Prompt 05 Verification
Prompt 06 Verification
Prompt 07 Verification
Prompt 08 Verification

Critical Findings

P0 Findings
P1 Findings
P2 Findings
P3 Findings

Implemented Fixes

Deferred Findings

Architecture Findings

Security Findings

AI Findings

Memory Findings

Frontend Findings

Backend Findings

Database Findings

Testing Findings

Operations Findings

Final Status
```

---

# 50. FINAL REQUIREMENT MATRIX

Create:

```text
docs/audit/mvp-09-final-verification-matrix.md
```

Columns:

| ID  | Requirement | Source Phase | Implementation | Test | Evidence | Status | Risk |
| --- | ----------- | ------------ | -------------- | ---- | -------- | ------ | ---- |

Every requirement from Prompt 00→08 must appear.

No orphaned requirement.

No unexplained missing requirement.

---

# 51. FINAL IMPLEMENTATION REPORT

Create:

```text
docs/audit/mvp-09-implementation-report.md
```

Include:

```text
What was audited
What was discovered
What was already genuinely complete
What was partially complete
What was missing
What was broken
What was implemented
What was intentionally not implemented
Why it was deferred
Tests added
Tests fixed
Security fixes
Performance fixes
UX fixes
Architecture fixes
Memory fixes
Agent fixes
Connector fixes
Database fixes
Final verification results
```

---

# 52. FINAL MVP SCORECARD

Produce:

| Area            | Score | Evidence | Remaining Risk |
| --------------- | ----: | -------- | -------------- |
| Product         |       |          |                |
| Frontend        |       |          |                |
| Backend         |       |          |                |
| Database        |       |          |                |
| Authentication  |       |          |                |
| Authorization   |       |          |                |
| Connectors      |       |          |                |
| Ingestion       |       |          |                |
| Memory          |       |          |                |
| Knowledge Graph |       |          |                |
| Vector Search   |       |          |                |
| Agents          |       |          |                |
| AI Safety       |       |          |                |
| Resume          |       |          |                |
| ATS             |       |          |                |
| Job Search      |       |          |                |
| Gmail           |       |          |                |
| Scheduler       |       |          |                |
| Audit           |       |          |                |
| Testing         |       |          |                |
| Performance     |       |          |                |
| Observability   |       |          |                |
| Accessibility   |       |          |                |
| Operations      |       |          |                |

Do not manufacture scores.

Every score must have evidence.

---

# 53. FINAL RELEASE GATES

Vaeloom MVP cannot be declared verified if any of these fail:

## Gate 1 — Core Journey

```text
Signup
→ Connect
→ Ingest
→ Organize
→ Remember
→ Retrieve
→ Agent
→ Approve
→ Act
→ Audit
→ Memory update
```

PASS REQUIRED.

---

## Gate 2 — Security

No known P0/P1 security issue.

PASS REQUIRED.

---

## Gate 3 — Data Integrity

No known corruption or cross-workspace data leak.

PASS REQUIRED.

---

## Gate 4 — Permissions

Agents cannot exceed their declared permissions.

PASS REQUIRED.

---

## Gate 5 — Memory

Memory can be:

```text
written
retrieved
updated
deduplicated
persisted
```

PASS REQUIRED.

---

## Gate 6 — Failure Recovery

Critical failures produce:

```text
clear error
safe state
retry/recovery
logs
```

PASS REQUIRED.

---

## Gate 7 — E2E

Critical E2E tests pass.

PASS REQUIRED.

---

## Gate 8 — Regression

Existing functionality remains operational after all fixes.

PASS REQUIRED.

---

## Gate 9 — Build

Clean build succeeds.

PASS REQUIRED.

---

## Gate 10 — Observability

Critical operations are traceable.

PASS REQUIRED.

---

# 54. FINAL RELEASE DECISION

At the end, output exactly one of:

```text
RELEASE_READY
```

or

```text
RELEASE_READY_WITH_DOCUMENTED_NON_BLOCKING_GAPS
```

or

```text
NOT_RELEASE_READY
```

Do not select RELEASE_READY simply because most work is complete.

---

# 55. RELEASE_READY REQUIREMENTS

Use:

```text
RELEASE_READY
```

only if:

- all P0 issues are closed
- all P1 issues are closed
- critical E2E flows pass
- security gates pass
- data integrity passes
- permissions pass
- memory core passes
- agent boundaries pass
- clean build passes
- regression suite passes
- critical failure paths pass

---

# 56. NON-BLOCKING GAP REQUIREMENTS

Use:

```text
RELEASE_READY_WITH_DOCUMENTED_NON_BLOCKING_GAPS
```

only when remaining issues:

- are P2/P3/P4
- do not affect core functionality
- do not create security risk
- do not corrupt data
- do not violate permissions
- are explicitly documented
- have owners/priorities
- have a future implementation plan

---

# 57. NOT RELEASE READY

Use:

```text
NOT_RELEASE_READY
```

if any:

```text
P0
P1 security
P1 data integrity
P1 permission
critical E2E failure
core memory failure
critical authentication failure
critical authorization failure
```

remains unresolved.

---

# 58. FINAL VERIFICATION COMMAND

Before concluding, run the complete available validation suite.

Use the repository's actual commands.

Do not invent commands.

If the repository does not have sufficient tests:

> ADD THE NECESSARY TESTS.

Do not report:

> "Unable to verify"

when the missing verification can reasonably be implemented.

---

# 59. FINAL RESPONSE FORMAT

Your final response to the project owner must be concise but evidence-based.

Use:

```text
# MVP Prompt 09 — Final Verification

## Overall Status
RELEASE_READY / RELEASE_READY_WITH_DOCUMENTED_NON_BLOCKING_GAPS / NOT_RELEASE_READY

## Prompt 00→08 Verification
- Prompt 00:
- Prompt 01:
- Prompt 02:
- Prompt 03:
- Prompt 04:
- Prompt 05:
- Prompt 06:
- Prompt 07:
- Prompt 08:

## What Was Actually Complete
...

## Missing Things Found
...

## Things Implemented During Prompt 09
...

## Critical Fixes
...

## Security
...

## Memory
...

## Agents
...

## E2E
...

## Regression
...

## Remaining Non-Blocking Gaps
...

## Evidence
- Tests:
- Build:
- E2E:
- Security:
- Performance:
- Database:
- AI:

## Final Decision
...
```

Do not claim something is verified without evidence.

---

# 60. MOST IMPORTANT PRINCIPLE

Prompt 09 is not:

> "Check whether Prompt 0–8 are done."

It is:

> "Prove whether Prompt 0–8 are actually done, find everything they missed, fix
> the important gaps, prove the fixes work, and establish a defensible final MVP
> release gate."

The objective is not a higher percentage.

The objective is:

> TRUSTWORTHY COMPLETION.

---

# 61. FINAL PRINCIPLE — NO FALSE COMPLETION

Never say:

> "Everything is complete."

unless the evidence supports it.

If something is unknown:

> mark it UNKNOWN / UNVERIFIED.

If something is incomplete:

> mark it PARTIAL.

If something is broken:

> mark it BROKEN.

If something is missing:

> mark it MISSING.

If something is intentionally deferred:

> mark it DEFERRED and explain why.

This phase exists specifically to prevent false confidence from previous
implementation phases.

---

# END OF PROMPT 09
