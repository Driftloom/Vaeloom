# FINDINGS: Scope and Count Mismatches in Phase Prompts (MVP-P00 through MVP-P07)

**Audit Date:** 2026-08-17 **Audited Files:** MVP-P00 through MVP-P07
**Severity:** P1-HIGH **Status:** FIXED (ALL prompts P00-P21 + README updated
2026-08-17)

---

## Finding 1: Memory Type Count — "Six" vs Actual 22

### Summary

**7 of 8 audited prompts** (P00, P01, P03, P04, P05, P06, P07) claim "six memory
types: Profile, Document, Career, Episodic, Preference, Working." The actual
codebase defines **22 memory types** in
`apps/api/src/api/schemas/memory_types.py`.

### Repository Reality

```
22 memory types defined in apps/api/src/api/schemas/memory_types.py:
Person, Organization, Project, Skill, Achievement, Education, Experience,
Certification, Publication, Patent, Award, Meeting, Task, Goal, Preference,
Constraint, Insight, Connection, Location, Event, Document, Conversation
```

### Correct Prompt

| Prompt  | Statement                                                                    | Status  |
| ------- | ---------------------------------------------------------------------------- | ------- |
| MVP-P02 | "22 memory types defined in `apps/api/src/api/schemas/memory_types.py:6-29`" | CORRECT |

### Incorrect Prompts (Need Fix)

| Prompt  | Line | Incorrect Text                                                                |
| ------- | ---- | ----------------------------------------------------------------------------- |
| MVP-P00 | 23   | "Six memory types: Profile, Document, Career, Episodic, Preference, Working." |
| MVP-P00 | 154  | "six memory types"                                                            |
| MVP-P01 | 23   | "Six memory types: Profile, Document, Career, Episodic, Preference, Working." |
| MVP-P01 | 194  | "six memory types"                                                            |
| MVP-P03 | 23   | "Six memory types: Profile, Document, Career, Episodic, Preference, Working." |
| MVP-P03 | 194  | "six memory types"                                                            |
| MVP-P04 | 23   | "Six memory types: Profile, Document, Career, Episodic, Preference, Working." |
| MVP-P04 | 194  | "six memory types"                                                            |
| MVP-P05 | 23   | "Six memory types: Profile, Document, Career, Episodic, Preference, Working." |
| MVP-P05 | 194  | "six memory types"                                                            |
| MVP-P06 | 24   | "Six memory types: Profile, Document, Career, Episodic, Preference, Working." |
| MVP-P06 | 220  | "six memory types"                                                            |
| MVP-P07 | 23   | "Six memory types: Profile, Document, Career, Episodic, Preference, Working." |
| MVP-P07 | 194  | "six memory types"                                                            |

### Additional Context from P02

P02 notes an important scope gap: "MemoryAgent handler scoped to 2 of 22
(Person, Organization) — scope gap carried as RB-07." This means:

- 22 types are DEFINED in the schema
- Only 2 are actually HANDLED by the MemoryAgent
- The remaining 20 types exist as data definitions but have no active agent
  processing

### Recommendation

1. Update the bullet list at line ~23 in each prompt to list all 22 types, or
   reference `schemas/memory_types.py`
2. Update the "six memory types" text in Section 3 of each prompt to "22 memory
   types (MemoryAgent handles Person and Organization; scope gap RB-07)"
3. The "six" was likely the original MVP design scope; the 22 are the expanded
   implementation

---

## Finding 2: Agent Count — "Eight" vs Actual 21 Registered

### Summary

All 8 prompts claim "eight total runtime agents including Orchestrator." This is
**technically accurate for MVP scope** but misleading because:

- **21 agents are registered** in
  `apps/api/src/api/orchestrator/router.py:38-60`
- **8 are MVP-canonical** (locked via `MVP_CANONICAL_AGENTS` frozenset)
- **13 are Enterprise-scope** (G1-G13)

### Repository Reality

```
MVP-canonical (8): organization, memory, resume, ats, job_search, application, gmail, scheduler
Enterprise (13): career, learning, research, github, coding, reminder, analytics,
                  recommendation, reflection, security, connector, plugin, drive
```

### Assessment

The "eight total agents" claim is **defensible** because
`settings.mvp_scope_enforced` locks to 8. However:

- P02 was updated to say "8 MVP-canonical agents (of 21 registered)" — this is
  the honest framing
- P00, P01, P03-P07 still say "eight total runtime agents" without the qualifier

### Recommendation

Update to: "8 MVP-canonical agents (of 21 registered; 13 enterprise-scope locked
behind `mvp_scope_enforced`)"

---

## Finding 3: Memory Type Names Mismatch

### Summary

The incorrect "six memory types" list uses names that DON'T MATCH the actual 22
types:

| Documented (Wrong) | Actual Code           |
| ------------------ | --------------------- |
| Profile            | Person                |
| Document           | Document (exists)     |
| Career             | Not a standalone type |
| Episodic           | Not a standalone type |
| Preference         | Preference (exists)   |
| Working            | Not a standalone type |

### Repository Reality

The actual 22 types are: Person, Organization, Project, Skill, Achievement,
Education, Experience, Certification, Publication, Patent, Award, Meeting, Task,
Goal, Preference, Constraint, Insight, Connection, Location, Event, Document,
Conversation.

### Assessment

"Profile", "Career", "Episodic", and "Working" were design-phase names that were
never implemented as memory types. The implementation used a different taxonomy.

### Recommendation

Remove the stale type names entirely. Replace with a reference to the actual
enum or list all 22.
