# Domain Agents Forensic Inventory

**Total Agent Packages Discovered**: 29  
**Agents with Real Handlers**: 28  
**Agents with Declarative agent.yaml Manifests**: 0 (0% - Critical Compliance
Gap)  
**Agents with Isolated Unit Tests**: 2

| Agent Name               | Handler? | Tools Count | Memory Read Scopes                                |     Autonomy     | Tests? | Manifest? |    Status     | Target Path                      |
| :----------------------- | :------: | ----------: | :------------------------------------------------ | :--------------: | :----: | :-------: | :-----------: | :------------------------------- |
| `analytics_agent`        |    ✅    |           6 | analytics, activity, applications, metrics        |   `read_only`    |   ❌   |    ❌     | `IMPLEMENTED` | `agents/analytics-agent/`        |
| `application_agent`      |    ✅    |           7 | career, timeline                                  | `approval_gated` |   ❌   |    ❌     | `IMPLEMENTED` | `agents/application-agent/`      |
| `ats_agent`              |    ✅    |           1 | career, skills                                    |   `read_only`    |   ❌   |    ❌     | `IMPLEMENTED` | `agents/ats-agent/`              |
| `calendar_agent`         |    ✅    |           4 | event, timeline, preference                       |    `suggest`     |   ❌   |    ❌     | `IMPLEMENTED` | `agents/calendar-agent/`         |
| `career_agent`           |    ✅    |           6 | career, skills, education, experience             |      `full`      |   ❌   |    ❌     | `IMPLEMENTED` | `agents/career-agent/`           |
| `coding_agent`           |    ✅    |           8 | coding, challenges, skills, progress              |    `suggest`     |   ❌   |    ❌     | `IMPLEMENTED` | `agents/coding-agent/`           |
| `connector_agent`        |    ✅    |           7 | connectors, integrations, configurations          |    `suggest`     |   ❌   |    ❌     | `IMPLEMENTED` | `agents/connector-agent/`        |
| `document_agent`         |    ✅    |           4 | document, knowledge, reference                    |   `read_only`    |   ✅   |    ❌     | `IMPLEMENTED` | `agents/document-agent/`         |
| `drive_agent`            |    ✅    |          10 | documents                                         |    `suggest`     |   ❌   |    ❌     | `IMPLEMENTED` | `agents/drive-agent/`            |
| `github_agent`           |    ✅    |          11 | github, skills, repositories, contributions       |    `suggest`     |   ❌   |    ❌     | `IMPLEMENTED` | `agents/github-agent/`           |
| `gmail_agent`            |    ✅    |           4 | communications                                    |    `suggest`     |   ❌   |    ❌     | `IMPLEMENTED` | `agents/gmail-agent/`            |
| `internship_agent`       |    ✅    |           4 | career, profile, skill, learning                  |    `suggest`     |   ❌   |    ❌     | `IMPLEMENTED` | `agents/internship-agent/`       |
| `job_search_agent`       |    ✅    |           9 | career, preferences                               |    `suggest`     |   ❌   |    ❌     | `IMPLEMENTED` | `agents/job-search-agent/`       |
| `learning_agent`         |    ✅    |           6 | skills, learning, goals, progress                 |    `suggest`     |   ❌   |    ❌     | `IMPLEMENTED` | `agents/learning-agent/`         |
| `memory`                 |    ❌    |           0 | None                                              |    `suggest`     |   ❌   |    ❌     |    `STUB`     | `agents/memory/`                 |
| `memory_agent`           |    ✅    |           4 | profile, document                                 |    `suggest`     |   ❌   |    ❌     | `IMPLEMENTED` | `agents/memory-agent/`           |
| `organization_agent`     |    ✅    |           4 | document, timeline                                |    `suggest`     |   ❌   |    ❌     | `IMPLEMENTED` | `agents/organization-agent/`     |
| `pdf_agent`              |    ✅    |           4 | document, profile                                 |    `suggest`     |   ❌   |    ❌     | `IMPLEMENTED` | `agents/pdf-agent/`              |
| `plugin_agent`           |    ✅    |           6 | plugins, extensions, versions, compatibility      |    `suggest`     |   ❌   |    ❌     | `IMPLEMENTED` | `agents/plugin-agent/`           |
| `qa_agent`               |    ✅    |           0 | None                                              |      `full`      |   ✅   |    ❌     |    `STUB`     | `agents/qa-agent/`               |
| `recommendation_agent`   |    ✅    |           6 | profile, skills, experience, preferences, network |    `suggest`     |   ❌   |    ❌     | `IMPLEMENTED` | `agents/recommendation-agent/`   |
| `reflection_agent`       |    ✅    |           6 | activity, goals, progress, achievements, timeline |    `suggest`     |   ❌   |    ❌     | `IMPLEMENTED` | `agents/reflection-agent/`       |
| `reminder_agent`         |    ✅    |           9 | tasks, deadlines, schedule, priorities            |      `full`      |   ❌   |    ❌     | `IMPLEMENTED` | `agents/reminder-agent/`         |
| `research_agent`         |    ✅    |           6 | research, companies, industries, trends           |      `full`      |   ❌   |    ❌     | `IMPLEMENTED` | `agents/research-agent/`         |
| `resume_agent`           |    ✅    |           6 | career, skills, achievements, education, timeline |    `suggest`     |   ❌   |    ❌     | `IMPLEMENTED` | `agents/resume-agent/`           |
| `scheduler_agent`        |    ✅    |           6 | schedule_events, timeline, deadlines              |      `full`      |   ❌   |    ❌     | `IMPLEMENTED` | `agents/scheduler-agent/`        |
| `security_agent`         |    ✅    |           6 | activity, access_logs, security_events            |      `full`      |   ❌   |    ❌     | `IMPLEMENTED` | `agents/security-agent/`         |
| `self_improvement_agent` |    ✅    |           4 | insight, feedback, agent_actions                  |    `suggest`     |   ❌   |    ❌     | `IMPLEMENTED` | `agents/self-improvement-agent/` |
| `workspace_agent`        |    ✅    |           4 | document, project, organization                   |    `suggest`     |   ❌   |    ❌     | `IMPLEMENTED` | `agents/workspace-agent/`        |
