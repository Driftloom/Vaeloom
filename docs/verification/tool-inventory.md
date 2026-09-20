# Tools Registry & Execution Ladder Forensic Inventory

**Total Discovered Tools in `definitions.py`**: 54  
**Executor Implementation**: `apps/api/src/api/tools/executor.py` (3,442
lines)  
**Static Approval-Gated Tools (`_BASE_APPROVAL_GATED`)**: 16  
**Dynamic Approval-Gated Tools**: Non-readOnly MCP Tools bridged at runtime

---

## 1. Complete Catalog of Discovered Tools

| Tool Name                       | Location in `definitions.py` | Category             | Mutating? | Approval Gating | Timeout | Execution Sandbox    |
| :------------------------------ | :--------------------------- | :------------------- | :-------: | :-------------: | :-----: | :------------------- |
| `append_google_doc`             | Line 257                     | Cloud Storage/Docs   |   `YES`   |     `GATED`     |   15s   | In-Process Async     |
| `audit_ats_formatting`          | Line 638                     | Career/Resume Domain |   `NO`    |     `OPEN`      |   15s   | In-Process Async     |
| `browse_job_page`               | Line 661                     | Job Search           |   `NO`    |     `OPEN`      |   60s   | Chromium Sandbox     |
| `calculate_ats_diff`            | Line 569                     | Career/Resume Domain |   `NO`    |     `OPEN`      |   15s   | In-Process Async     |
| `calculate_semantic_ats_score`  | Line 586                     | Career/Resume Domain |   `NO`    |     `OPEN`      |   15s   | In-Process Async     |
| `categorize_document`           | Line 105                     | Knowledge/Search     |   `YES`   |     `GATED`     |   15s   | In-Process Async     |
| `compile_cover_letter`          | Line 961                     | Career/Resume Domain |   `YES`   |     `OPEN`      |   60s   | In-Process Async     |
| `compile_resume_docx`           | Line 944                     | Career/Resume Domain |   `YES`   |     `OPEN`      |   60s   | In-Process Async     |
| `compile_resume_pdf`            | Line 926                     | Career/Resume Domain |   `YES`   |     `OPEN`      |   60s   | Chromium Sandbox     |
| `create_calendar_event`         | Line 514                     | Calendar/Mail        |   `YES`   |     `GATED`     |   15s   | In-Process Async     |
| `create_entity`                 | Line 72                      | Knowledge/Search     |   `YES`   |     `GATED`     |   15s   | In-Process Async     |
| `create_github_issue`           | Line 759                     | GitHub Integration   |   `YES`   |     `GATED`     |   15s   | In-Process Async     |
| `create_github_pull_request`    | Line 844                     | GitHub Integration   |   `YES`   |     `GATED`     |   15s   | In-Process Async     |
| `create_google_doc`             | Line 226                     | Cloud Storage/Docs   |   `YES`   |     `GATED`     |   15s   | In-Process Async     |
| `create_outlook_calendar_event` | Line 396                     | Calendar/Mail        |   `YES`   |     `GATED`     |   15s   | In-Process Async     |
| `download_drive_file`           | Line 209                     | Cloud Storage/Docs   |   `NO`    |     `OPEN`      |   15s   | In-Process Async     |
| `download_onedrive_file`        | Line 446                     | Cloud Storage/Docs   |   `NO`    |     `OPEN`      |   15s   | In-Process Async     |
| `draft_email`                   | Line 496                     | Communication        |   `YES`   |     `GATED`     |   15s   | In-Process Async     |
| `draft_outlook_mail`            | Line 363                     | Calendar/Mail        |   `YES`   |     `GATED`     |   15s   | In-Process Async     |
| `execute_code_sandbox`          | Line 900                     | Compute/Execution    |   `YES`   |     `GATED`     |   60s   | Subprocess Isolation |
| `extract_missing_hard_skills`   | Line 615                     | Knowledge/Search     |   `NO`    |     `OPEN`      |   15s   | In-Process Async     |
| `fetch_github_repo`             | Line 741                     | GitHub Integration   |   `NO`    |     `OPEN`      |   15s   | In-Process Async     |
| `get_entity`                    | Line 56                      | Knowledge/Search     |   `NO`    |     `OPEN`      |   15s   | In-Process Async     |
| `get_github_profile`            | Line 795                     | GitHub Integration   |   `NO`    |     `OPEN`      |   15s   | In-Process Async     |
| `list_calendar_events`          | Line 160                     | Calendar/Mail        |   `NO`    |     `OPEN`      |   15s   | In-Process Async     |
| `list_drive_files`              | Line 177                     | Cloud Storage/Docs   |   `NO`    |     `OPEN`      |   15s   | In-Process Async     |
| `list_github_issues`            | Line 810                     | GitHub Integration   |   `NO`    |     `OPEN`      |   15s   | In-Process Async     |
| `list_onedrive_files`           | Line 414                     | Cloud Storage/Docs   |   `NO`    |     `OPEN`      |   15s   | In-Process Async     |
| `list_outlook_calendar_events`  | Line 380                     | Calendar/Mail        |   `NO`    |     `OPEN`      |   15s   | In-Process Async     |
| `merge_entities`                | Line 89                      | Knowledge/Search     |   `YES`   |     `GATED`     |   15s   | In-Process Async     |
| `move_file`                     | Line 480                     | Knowledge/Search     |   `YES`   |     `GATED`     |   15s   | In-Process Async     |
| `notify_user`                   | Line 985                     | Communication        |   `NO`    |     `OPEN`      |   15s   | In-Process Async     |
| `parse_document_ocr`            | Line 552                     | Knowledge/Search     |   `NO`    |     `OPEN`      |   15s   | In-Process Async     |
| `query_graph`                   | Line 39                      | Knowledge/Search     |   `NO`    |     `OPEN`      |   15s   | In-Process Async     |
| `query_notebooklm`              | Line 1001                    | Knowledge/Search     |   `NO`    |     `OPEN`      |   15s   | In-Process Async     |
| `read_github_file`              | Line 827                     | GitHub Integration   |   `NO`    |     `OPEN`      |   15s   | In-Process Async     |
| `read_google_doc`               | Line 242                     | Cloud Storage/Docs   |   `NO`    |     `OPEN`      |   15s   | In-Process Async     |
| `rename_file`                   | Line 464                     | Knowledge/Search     |   `YES`   |     `GATED`     |   15s   | In-Process Async     |
| `replace_google_doc_text`       | Line 273                     | Cloud Storage/Docs   |   `YES`   |     `GATED`     |   15s   | In-Process Async     |
| `scrape_company_insights`       | Line 688                     | Web Scraping         |   `NO`    |     `OPEN`      |   15s   | Chromium Sandbox     |
| `search_documents`              | Line 23                      | Knowledge/Search     |   `NO`    |     `OPEN`      |   15s   | In-Process Async     |
| `search_drive`                  | Line 193                     | Cloud Storage/Docs   |   `NO`    |     `OPEN`      |   15s   | In-Process Async     |
| `search_github_repos`           | Line 777                     | GitHub Integration   |   `NO`    |     `OPEN`      |   15s   | In-Process Async     |
| `search_gmail`                  | Line 125                     | Knowledge/Search     |   `NO`    |     `OPEN`      |   15s   | In-Process Async     |
| `search_greenhouse_jobs`        | Line 292                     | Job Search           |   `NO`    |     `OPEN`      |   15s   | In-Process Async     |
| `search_jobs`                   | Line 142                     | Job Search           |   `NO`    |     `OPEN`      |   15s   | In-Process Async     |
| `search_jobs_board`             | Line 328                     | Job Search           |   `NO`    |     `OPEN`      |   15s   | In-Process Async     |
| `search_lever_jobs`             | Line 310                     | Job Search           |   `NO`    |     `OPEN`      |   15s   | In-Process Async     |
| `search_onedrive`               | Line 430                     | Cloud Storage/Docs   |   `NO`    |     `OPEN`      |   15s   | In-Process Async     |
| `search_outlook_mail`           | Line 347                     | Calendar/Mail        |   `NO`    |     `OPEN`      |   15s   | In-Process Async     |
| `send_slack_message`            | Line 864                     | Communication        |   `YES`   |     `GATED`     |   15s   | In-Process Async     |
| `sync_notion_pages`             | Line 881                     | Knowledge/Search     |   `YES`   |     `OPEN`      |   15s   | In-Process Async     |
| `verify_application_link`       | Line 714                     | Knowledge/Search     |   `NO`    |     `OPEN`      |   15s   | In-Process Async     |
| `web_search`                    | Line 535                     | Knowledge/Search     |   `NO`    |     `OPEN`      |   15s   | In-Process Async     |

---

## 2. Tool Architecture Findings & Violations

1. **Monolithic Tool Executor (`ARCH-P1-02`)**:
   - `apps/api/src/api/tools/executor.py` spans **3,442 lines of code** and
     implements all 54 tool execution functions in a single class
     `ToolExecutor`.
   - Lacks modularity: GitHub, Google Drive, OneDrive, Slack, ATS scoring,
     document conversion, and sandbox execution are tightly coupled in one file.
2. **Approval Ladder Implementation**:
   - Gated tools are defined statically in `_BASE_APPROVAL_GATED` within
     `executor.py:48-62`.
   - Interception occurs in `apps/api/src/api/orchestrator/loop.py:1536` and
     `loop.py:1808`.
   - If approval is missing, tool invocation returns a staged `ApprovalRequest`
     record and pauses agent execution.
3. **Execution Sandboxing**:
   - `execute_code_sandbox`: Implemented via
     `apps/api/src/api/services/plugin_service.py` using subprocess isolation
     with timeout.
   - `browse_job_page`, `scrape_company_insights`: Uses Playwright Chromium with
     URL guard SSRF validation (`api.utils.url_guard`).
   - All other 51 tools execute directly in-process within the FastAPI event
     loop, posing memory and denial-of-service risks if external services hang.
4. **Target Architectural Disposition**:
   - Split `apps/api/src/api/tools/executor.py` into modular handlers under
     `packages/agent-tools/`:
     - `packages/agent-tools/registry.py` (contract & metadata)
     - `packages/agent-tools/handlers/knowledge.py`
     - `packages/agent-tools/handlers/integrations.py`
     - `packages/agent-tools/handlers/career.py`
     - `packages/agent-tools/handlers/browser.py`
     - `packages/agent-tools/handlers/sandbox.py`
