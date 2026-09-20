# 20. Memory UX & Knowledge Graphs

## 1. Memory as Core Product Surface

In Vaeloom, memory is not a background cache; it is a first-class interactive
workspace surface. Users must be able to:

1. Inspect what the system knows.
2. Verify where that knowledge originated.
3. Edit, invalidate, or delete outdated memory records.

## 2. Memory Interaction Components

- `<MemoryCard>`: Container displaying an atomic memory unit (e.g. "Prefers
  morning meetings before 11 AM", "Primary tech stack: TypeScript & Next.js").
  - Confidence badge (`94% confident`).
  - Source indicator (`Extracted from Slack #engineering`).
  - Invalidate / Edit action.
- `<MemoryEntity>`: Semantic entity badge (Person, Company, Project, Topic,
  Skill) with entity type icon.
- `<MemoryRelationship>`: Directional relation pill (`WORKS_AT`, `SKILLED_IN`,
  `AUTHORED`).
- `<MemoryTimeline>`: Chronological stream of memory ingestions and revisions.
- `<MemoryEvidence>`: Raw source snippet with highlight highlighting the exact
  sentence or data point from which memory was synthesized.
