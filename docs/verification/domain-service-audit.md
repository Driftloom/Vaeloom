# Deterministic Domain Services Forensic Audit

## 1. Executive Summary

This audit inspects the business logic services currently embedded in
`apps/api/src/api/services/` that must be extracted into pure,
framework-independent libraries under `packages/domain/`.

---

## 2. Inventory of Candidate Domain Services

| Domain Service File       | Lines | Business Function                                          | Framework Coupling                | Target Package in `packages/domain/` |
| :------------------------ | :---: | :--------------------------------------------------------- | :-------------------------------- | :----------------------------------- |
| `semantic_ats.py`         |  740  | Semantic ATS scoring, keyword gazetteer, skills extraction | Independent (Pure Math/Regex)     | `packages/domain/ats/`               |
| `document_builder.py`     |  980  | Resume & Cover Letter PDF/DOCX rendering, page-fit loop    | Playwright Chromium / python-docx | `packages/domain/resume/`            |
| `resume_templates.py`     |  420  | 5 industry resume templates & HTML/Jinja2 mappings         | Pure Jinja2 templates             | `packages/domain/resume/`            |
| `salary_service.py`       |  380  | Compensation benchmarks, salary ranges, percentile stats   | Pure statistical tables           | `packages/domain/salary/`            |
| `profile_service.py`      |  510  | Candidate skills taxonomy, experience aggregation          | Coupled to SQLAlchemy session     | `packages/domain/profile/`           |
| `job_matcher.py`          |  460  | Career fit algorithms, vacancy relevance scoring           | Pure cosine & vector math         | `packages/domain/career/`            |
| `notification_service.py` |  320  | Notification templating, formatting, email rendering       | Independent                       | `packages/domain/notifications/`     |

---

## 3. Extraction Feasibility & Zero-Trust Verification

- **`semantic_ats.py`**: 100% pure Python with zero database imports. Already
  verified via `tests/test_semantic_ats_tools.py` (Level 1 executable proof).
  Ready for immediate extraction to `packages/domain/ats/`.
- **`document_builder.py`**: Independent compilation engine with fallback when
  Chromium is absent. Ready for extraction to `packages/domain/resume/`.
- **`profile_service.py`**: Requires decoupling from `db: AsyncSession` by
  accepting typed Pydantic profile inputs instead of executing ORM queries.
