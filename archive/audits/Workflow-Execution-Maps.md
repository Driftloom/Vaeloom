# Workflow Execution Maps

> Source: section 14 (5 traces A-E).

A User Question, B File Ingestion, C Resume, D Job Discovery, E Gmail
Intelligence.

- A: User Question — ChatWindow.tsx agentApi.chat -> POST
  /api/v1/agents/chat(stream) -> Auth/Tenant/Rate/PromptInjection ->
  router.handle classify->loop RAG->QA->approvals -> SSE done. P50 1.2s simple,
  7s supervisor.
- B: File Ingestion — upload -> ingestion/pipeline
  parse->dedup->Document/Version -> chunk->embedding -> OrganizationAgent
  proposal -> approval -> Audit -> KG+Memory.
- C: Resume — RAG evidence -> XYZ variants -> validation -> compile pdf/docx via
  Playwright/python-docx -> ResumeArtifact.
- D: Job Discovery — search_jobs_board fan-out greenhouse/lever/generic -> dedup
  -> match -> gap -> tailoring approval -> verify link -> career memory.
- E: Gmail — scheduled 6AM cron + push webhook historyId -> fetch -> classify ->
  extract deadline/priority -> schedule -> episodic memory -> notify.

See audit section 14 for per-workflow service/DB/tool/model/audit/failure/cost.
