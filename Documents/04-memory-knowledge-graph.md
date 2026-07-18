Vaeloom Â· Memory System

# One graph, six kinds of memory

Every agent reads from and writes to the same underlying graph — this is what makes the resume, the job search, and the chat all feel like they "know" the same person.

Knowledge
Graph

the second brain

Profile
Memory

education, skills, certifications

Document
Memory

per-file summary & embedding

Career
Memory

applications, outcomes

Episodic
Memory

timestamped events

Preference
Memory

inferred & stated patterns

Working
Memory

current session context

Read path

### Agentic RAG retrieval

When an agent needs context, it doesn't run one fixed search — it picks a strategy for the question in front of it.

Query from an agent

â†“

Hybrid search — vector + keyword + graph traversal

â†“

Re-rank by relevance, recency, confidence

â†“

Assembled context returned to agent

Write path

### How memory gets updated

Every agent action is a potential memory update — this is what keeps the graph current without the user doing any manual linking.

New info from any agent

â†“

Extract entities & facts

â†“

Dedup / merge against existing nodes

â†“

Write to graph + vector store, consolidate over time

Working Memory is the only type that's cleared per session — everything else persists and compounds over years of use.