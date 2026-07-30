# RAG Pipeline Prompts

## Retrieval Prompt

Given the user's query, retrieve the most relevant context from the memory store
and knowledge graph. Follow these steps:

1. Parse query intent (factual, comparative, procedural, exploratory)
2. Generate search embedding from query
3. Search vector store (top-k = 10, min_score = 0.7)
4. Search knowledge graph for related entities (depth = 2)
5. Rerank results by relevance
6. Filter by permission scope

## Generation Prompt

Context:
{retrieved_context}

User Query: {query}

Instructions:
- Answer only using the provided context
- If the context doesn't contain the answer, say so
- Cite sources using [memory_id] notation
- Keep answers concise and actionable
