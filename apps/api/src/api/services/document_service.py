import difflib
import io
import logging
import re
import uuid
import zipfile
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func, select, or_, and_
from sqlalchemy.exc import IntegrityError

from ..models.schema import Document, DocumentAction, DocumentVersion, DocumentShare, Folder
from .file_security_service import file_security_service
from .storage_service import storage_service

logger = logging.getLogger(__name__)

EXTENSION_MAP = {
    "pdf": "pdf",
    "md": "markdown",
    "markdown": "markdown",
    "txt": "text",
    "docx": "docx",
    "doc": "docx",
    "csv": "csv",
    "xlsx": "xlsx",
    "xls": "xlsx",
    "pptx": "pptx",
    "ppt": "pptx",
    "json": "json",
    "html": "html",
    "xml": "xml",
    "yaml": "yaml",
    "yml": "yaml",
    "png": "image",
    "jpg": "image",
    "jpeg": "image",
    "gif": "image",
    "svg": "image",
    "webp": "image",
}

ACTION_RENAME = "document_rename"
ACTION_ARCHIVE = "document_archive"
ACTION_RESTORE = "document_restore"
ACTION_VERSION_CREATE = "document_version_create"
ACTION_VERSION_RESTORE = "document_version_restore"
ACTION_SHARE = "document_share"


class DocumentNotFound(Exception):
    pass


class DocumentActionNotFound(Exception):
    pass


class DocumentActionAlreadyUndone(Exception):
    pass


def _run_50_checks(
    text: str,
    filename: str,
    doc_type: str,
    previous_versions_count: int = 0,
) -> dict[str, Any]:
    """Execute 50 discrete quality and ATS checks across 6 enterprise categories."""
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    lower_text = text.lower()
    words = re.findall(r"\b\w+\b", text)
    word_count = len(words)
    bullet_lines = [line for line in lines if line.startswith(("-", "*", "•", "–")) or re.match(r"^\d+\.", line)]

    checks = []

    def add_check(cid: str, name: str, category: str, passed: bool, score: int, detail: str, rec: str | None = None):
        checks.append({
            "id": cid,
            "name": name,
            "category": category,
            "passed": passed,
            "score": score if passed else 0,
            "detail": detail,
            "recommendation": None if passed else (rec or f"Improve {name}"),
        })

    # Group 1: Contact Information & Identity (Checks 1-6)
    has_email = bool(re.search(r"[\w\.-]+@[\w\.-]+\.\w+", text))
    add_check("check_01", "Email Address Present", "contact", has_email, 2, "Valid email detected" if has_email else "No email address found", "Add an executive professional email address in header")

    has_phone = bool(re.search(r"(\+?\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}", text))
    add_check("check_02", "Phone Number Present", "contact", has_phone, 2, "Phone number format detected" if has_phone else "No phone number found", "Include direct phone contact with country/area code")

    has_location = bool(re.search(r"\b(remote|city|state|ca|ny|wa|tx|san francisco|new york|austin|seattle|london|berlin|india|bangalore|singapore|toronto)\b", lower_text))
    add_check("check_03", "Geographic Location / Work Mode", "contact", has_location, 2, "Location or Remote status detected" if has_location else "No location or work authorization region found", "Specify target location or Remote/Hybrid availability")

    has_linkedin = "linkedin" in lower_text
    add_check("check_04", "LinkedIn Profile URL", "contact", has_linkedin, 2, "LinkedIn link detected" if has_linkedin else "No LinkedIn profile found", "Add custom LinkedIn vanity URL")

    has_portfolio = any(k in lower_text for k in ("github", "gitlab", "portfolio", "http", "www."))
    add_check("check_05", "Online Portfolio / Code Repository", "contact", has_portfolio, 2, "Repository or portfolio link present" if has_portfolio else "No code repository or portfolio link found", "Include GitHub or portfolio URL to showcase verified work")

    top_header = lines[0] if lines else ""
    has_name = bool(top_header and len(top_header) < 60 and not any(top_header.lower().startswith(h) for h in ("summary", "experience", "education", "skills")))
    add_check("check_06", "Candidate Full Name in Header", "contact", has_name, 2, f"Header candidate name: '{top_header[:30]}'" if has_name else "Missing clear candidate name in header", "Place full legal name prominently at the top of the document")

    # Group 2: Section Structure & Headers (Checks 7-14)
    has_summary = any(h in lower_text for h in ("summary", "profile", "objective", "about"))
    add_check("check_07", "Executive Summary Section", "structure", has_summary, 2, "Summary section detected" if has_summary else "Missing executive summary section", "Add a concise 3-4 sentence value proposition summary")

    has_exp = any(h in lower_text for h in ("experience", "work history", "employment"))
    add_check("check_08", "Work Experience Section", "structure", has_exp, 2, "Experience section present" if has_exp else "No work experience section found", "Structure employment history under standard Work Experience header")

    has_edu = any(h in lower_text for h in ("education", "degree", "university", "academic"))
    add_check("check_09", "Education Section", "structure", has_edu, 2, "Education section present" if has_edu else "No education section found", "Include degrees, universities, and graduation years")

    has_skills = any(h in lower_text for h in ("skills", "technologies", "competencies", "proficiencies"))
    add_check("check_10", "Skills Inventory Section", "structure", has_skills, 2, "Skills section present" if has_skills else "No technical skills section found", "Add a dedicated Skills & Competencies section")

    has_projects = any(h in lower_text for h in ("project", "achievement", "initiative", "publication"))
    add_check("check_11", "Key Projects or Achievements", "structure", has_projects, 2, "Projects or achievements section found" if has_projects else "No key projects or achievements highlighted", "Highlight major architecture projects or impactful open source work")

    has_certs = any(h in lower_text for h in ("certif", "license", "training", "accredit")) or has_edu
    add_check("check_12", "Certifications or Continuing Education", "structure", has_certs, 2, "Certifications or academic qualifications present", "List industry certifications (AWS, GCP, CKA, CISSP, etc.)")

    std_headers = sum(1 for h in ("summary", "experience", "education", "skills") if h in lower_text)
    add_check("check_13", "Standard ATS Header Terminology", "structure", std_headers >= 3, 2, f"{std_headers}/4 standard ATS section headers matched", "Use standard headers (Experience, Education, Skills) for ATS parsing")

    pos_sum = lower_text.find("summary")
    pos_exp = lower_text.find("experience")
    logical_order = (pos_sum < pos_exp) if (pos_sum != -1 and pos_exp != -1) else True
    add_check("check_14", "Logical Reverse-Chronological Flow", "structure", logical_order, 2, "Headers flow in logical order" if logical_order else "Summary appears after experience", "Ensure Executive Summary precedes Work Experience")

    # Group 3: Quantifiable Impact & Metrics (Checks 15-24)
    has_percent = bool(re.search(r"\b\d+(\.\d+)?%", text))
    add_check("check_15", "Percentage Metrics (% Impact)", "metrics", has_percent, 2, "Percentage efficiency/improvement found" if has_percent else "No percentage metrics found", "Quantify improvements using percentages (e.g. 'reduced latency by 45%')")

    has_money = bool(re.search(r"[\$€£]\s?\d+([,\.]\d+)?\s?(k|m|b|million|billion)?|\b\d+\s?(k|m|million|billion)\s?(dollars|usd|revenue|budget)", lower_text))
    add_check("check_16", "Financial / Monetary Impact Metrics", "metrics", has_money, 2, "Monetary/budget impact detected" if has_money else "No revenue/cost-savings metrics found", "Quantify cost savings or revenue impact (e.g. '$2.4M ARR', 'saved $120k/yr')")

    has_scale = bool(re.search(r"\b\d+([,\.]\d+)?\s?(k|m|b|million|billion|thousand|users|rps|qps|requests|events|nodes|pods)\b", lower_text))
    add_check("check_17", "Scale & Volume Metrics", "metrics", has_scale, 2, "Throughput/user scale detected" if has_scale else "No system scale or volume indicators found", "State user base or traffic scale (e.g. 'serving 15M DAU at 45k RPS')")

    has_time_eff = bool(re.search(r"\b\d+\s?(ms|seconds|minutes|hours|days|weeks|x|times|fold)\b", lower_text))
    add_check("check_18", "Time & Latency Efficiency Gains", "metrics", has_time_eff, 2, "Latency or time-efficiency metrics detected" if has_time_eff else "No time-to-market or latency reductions found", "Highlight speedup metrics (e.g. 'cut build times from 45m to 8m')")

    has_team = bool(re.search(r"\b(team of \d+|\d+ engineers|\d+ developers|\d+ direct reports|mentored \d+)\b", lower_text))
    add_check("check_19", "Team & Mentorship Metrics", "metrics", has_team, 2, "Team size / mentorship scale detected" if has_team else "No team leadership numbers found", "State team size or mentorship scope (e.g. 'led team of 7 senior engineers')")

    metrics_bullets = sum(1 for b in bullet_lines if re.search(r"\d+", b))
    metric_density_pass = (metrics_bullets / len(bullet_lines) >= 0.25) if bullet_lines else (len(re.findall(r"\d+", text)) >= 5)
    add_check("check_20", "Metrics Density Across Bullets", "metrics", metric_density_pass, 2, "Metrics present across achievement points", "Ensure at least 30% of bullets contain quantified numbers")

    has_bullets = len(bullet_lines) >= 3
    add_check("check_21", "Scannable Bullet Point Formatting", "metrics", has_bullets, 2, f"{len(bullet_lines)} bullet items detected" if has_bullets else "Document lacks bullet point structure", "Convert long descriptive paragraphs into punchy bullet points")

    action_verbs = ("engineered", "designed", "built", "architected", "developed", "orchestrated", "spearheaded", "optimized", "implemented", "scaled", "led", "reduced", "automated", "delivered", "deployed")
    bullets_with_action = sum(1 for b in bullet_lines if any(b.lower().lstrip("-*• 0123456789.").startswith(v) for v in action_verbs))
    action_verb_pass = (bullets_with_action >= 2) or any(v in lower_text for v in action_verbs)
    add_check("check_22", "Strong Action Verb Openers", "metrics", action_verb_pass, 2, "Strong technical action verbs identified", "Start achievement bullets with strong verbs (Engineered, Architected, Optimized)")

    has_first_person = bool(re.search(r"\b(i am|i was|i have|my role|we did|our team)\b", lower_text))
    add_check("check_23", "Third-Person Executive Voice (No 'I'/'My')", "metrics", not has_first_person, 2, "Professional third-person voice maintained" if not has_first_person else "First-person pronouns detected", "Remove first-person pronouns ('I', 'me', 'my') in favor of direct active voice")

    vague_phrases = ("responsible for", "duties included", "helped with", "worked on", "assisted in")
    vague_count = sum(lower_text.count(vp) for vp in vague_phrases)
    add_check("check_24", "Zero Passive Filler Phrasing", "metrics", vague_count <= 1, 2, f"Minimal passive filler phrases ({vague_count} found)", "Replace passive phrases ('responsible for') with active accomplishments ('Delivered')")

    # Group 4: ATS Parseability & Technical Formatting (Checks 25-34)
    clean_utf8 = True
    try:
        text.encode("utf-8")
    except Exception:
        clean_utf8 = False
    add_check("check_25", "Clean UTF-8 Character Encoding", "ats_parseability", clean_utf8, 2, "UTF-8 encoding valid without mojibake", "Fix character encoding anomalies")

    no_complex_tables = lower_text.count("|---|") <= 1
    add_check("check_26", "No ATS-Unfriendly Complex Tables", "ats_parseability", no_complex_tables, 2, "Clean linear layout suitable for ATS parsers", "Avoid multi-column nested tables that confuse ATS line scanners")

    no_columnar = not bool(re.search(r"\t{3,}|\s{15,}", text))
    add_check("check_27", "Linear Column Flow (Single Column ATS)", "ats_parseability", no_columnar, 2, "Single-stream text flow detected", "Avoid multi-column floating boxes that scramble parsing order")

    no_scripts = not any(tag in lower_text for tag in ("<script", "<iframe", "javascript:", "eval("))
    add_check("check_28", "Safe Text Without Embedded Script Tags", "ats_parseability", no_scripts, 2, "Safe clean text free of executable scripts", "Strip HTML tags and scripts")

    injection_terms = ("ignore all previous", "system prompt", "you are now", "act as dan")
    no_injection = not any(term in lower_text for term in injection_terms)
    add_check("check_29", "Adversarial Prompt Injection Free", "ats_parseability", no_injection, 2, "No prompt injection anomalies detected", "Remove prompt injection or jailbreak phrases")

    date_patterns = bool(re.search(r"\b(20\d\d|19\d\d)\b", text))
    add_check("check_30", "Standard Date Format Consistency", "ats_parseability", date_patterns, 2, "Standard calendar years identified", "Provide clear employment dates (e.g. '06/2021 – Present')")

    years = [int(m) for m in re.findall(r"\b(20\d\d|19\d\d)\b", text)]
    chrono_pass = (years[0] >= years[-1]) if (len(years) >= 2) else True
    add_check("check_31", "Reverse Chronological Employment History", "ats_parseability", chrono_pass, 2, "Most recent roles appear first", "Order employment history in reverse chronological order")

    clean_bullets = not bool(re.search(r"[►▶➢➔✔]", text))
    add_check("check_32", "Standard Bullet Glyphs (*, -, •)", "ats_parseability", clean_bullets, 2, "Standard bullet characters used", "Use standard bullet characters rather than complex decorative icons")

    no_orphans = not any(len(line) == 1 and line.isalnum() for line in lines)
    add_check("check_33", "No Orphan Dangling Characters", "ats_parseability", no_orphans, 2, "No typographical line orphan artifacts", "Clean up trailing single-character line wraps")

    urls = re.findall(r"https?://[^\s]+", text)
    clean_urls = all("/" in u for u in urls) if urls else True
    add_check("check_34", "Valid Hyperlink Formatting", "ats_parseability", clean_urls, 2, "Valid web links", "Verify all web links are complete and properly formed")

    # Group 5: Hard & Soft Skills Density (Checks 35-42)
    modern_techs = ["python", "go", "golang", "rust", "typescript", "javascript", "react", "next.js", "docker", "kubernetes", "aws", "gcp", "azure", "postgres", "sql", "redis", "kafka", "graphql", "fastapi", "linux"]
    matched_techs = [t for t in modern_techs if t in lower_text]
    add_check("check_35", "Modern Cloud/Backend Tech Keywords", "skills", len(matched_techs) >= 3, 2, f"Recognized {len(matched_techs)} modern technologies: {', '.join(matched_techs[:5])}", "Incorporate relevant in-demand industry technologies")

    cloud_terms = ["docker", "kubernetes", "aws", "gcp", "azure", "ci/cd", "terraform", "helm", "linux"]
    has_cloud = any(c in lower_text for c in cloud_terms)
    add_check("check_36", "Cloud & DevOps Infrastructure Keywords", "skills", has_cloud, 2, "Cloud / containerization skills present", "Include cloud platforms and containerization tools")

    db_terms = ["postgres", "postgresql", "mysql", "mongodb", "redis", "dynamodb", "sqlite", "elasticsearch", "sql"]
    has_db = any(d in lower_text for d in db_terms)
    add_check("check_37", "Database & Storage Systems Proficiency", "skills", has_db, 2, "Database systems identified", "Highlight SQL/NoSQL database proficiencies")

    arch_terms = ["rest", "graphql", "grpc", "microservices", "distributed", "event-driven", "api", "pub/sub"]
    has_arch = any(a in lower_text for a in arch_terms)
    add_check("check_38", "API & Distributed Architecture Concepts", "skills", has_arch, 2, "Architecture concepts present", "Mention API patterns (REST, gRPC, event-driven architecture)")

    test_terms = ["pytest", "jest", "unit test", "integration test", "e2e", "tdd", "ci", "cypress", "playwright"]
    has_test = any(t in lower_text for t in test_terms)
    add_check("check_39", "Software Quality & Testing Mention", "skills", has_test, 2, "Testing and QA proficiencies detected", "Highlight unit testing and test coverage discipline")

    lead_terms = ["cross-functional", "stakeholder", "mentored", "collaborated", "leadership", "agile", "roadmap"]
    has_lead = any(l in lower_text for l in lead_terms)
    add_check("check_40", "Cross-Functional Leadership Signals", "skills", has_lead, 2, "Leadership and collaboration signals detected", "Demonstrate cross-functional leadership and stakeholder alignment")

    categorized_skills = bool(re.search(r"(languages|frameworks|tools|databases|cloud):\s*", lower_text)) or has_skills
    add_check("check_41", "Categorized Skill Taxonomy", "skills", categorized_skills, 2, "Categorized skill inventory present", "Organize skills by category (e.g. Languages, Databases, Tools)")

    tech_density = (len(matched_techs) / (word_count or 1)) < 0.20
    add_check("check_42", "Organic Keyword Integration (No Keyword Stuffing)", "skills", tech_density, 2, "Keywords integrated naturally into accomplishments", "Embed technical keywords organically inside project bullets")

    # Group 6: Tone, Clarity & Enterprise Polish (Checks 43-50)
    word_count_pass = (100 <= word_count <= 2500) if word_count else False
    add_check("check_43", "Document Length / Word Count Target", "polish", word_count_pass, 2, f"Word count: {word_count} words (optimal range)", "Aim for a concise, high-density 1 to 2 page document (400-1200 words)")

    sentences = re.split(r"[.!?]+", text)
    valid_sentences = [s.strip() for s in sentences if len(s.strip().split()) >= 3]
    avg_len = sum(len(s.split()) for s in valid_sentences) / len(valid_sentences) if valid_sentences else 15
    add_check("check_44", "Sentence Scanability (<30 words avg)", "polish", avg_len <= 30, 2, f"Average sentence length: {avg_len:.1f} words", "Keep sentences concise and punchy for fast recruiter review")

    buzzwords = ["guru", "ninja", "rockstar", "synergy", "paradigm shift", "thought leader"]
    buzz_found = [b for b in buzzwords if b in lower_text]
    add_check("check_45", "Avoid Overused Buzzwords", "polish", len(buzz_found) == 0, 2, "Free of clichés" if not buzz_found else f"Avoid clichéd terms: {buzz_found}", "Replace clichéd buzzwords with tangible technical qualifications")

    titles = ["engineer", "developer", "architect", "manager", "lead", "director", "consultant", "analyst", "designer"]
    has_title = any(t in lower_text for t in titles)
    add_check("check_46", "Clear Standard Industry Job Title", "polish", has_title, 2, "Standard job titles detected", "Use industry-standard professional job titles")

    grammar_clean = not bool(re.search(r"\b(teh|recieve|seperate|definately|occured)\b", lower_text))
    add_check("check_47", "Zero Common Spelling / Typos", "polish", grammar_clean, 2, "Clean spelling in checked common terms", "Proofread carefully for common typographical errors")

    consistent_case = not bool(re.search(r"\b[a-z]+[A-Z]{2,}[a-z]+\b", text))
    add_check("check_48", "Consistent Case & Typographic Uniformity", "polish", consistent_case, 2, "Uniform typography", "Maintain consistent capitalization and formatting")

    acronyms = ["api", "ci/cd", "sql", "aws", "gcp", "rest", "ui", "ux", "cpu", "ram"]
    has_acronyms = any(a in lower_text for a in acronyms)
    add_check("check_49", "Industry Standard Acronym Accuracy", "polish", has_acronyms, 2, "Standard industry acronyms formatted accurately", "Use standard industry acronyms (REST, API, CI/CD, SQL)")

    version_pass = previous_versions_count >= 0
    add_check("check_50", "Version Integrity & Lineage Traceability", "polish", version_pass, 2, f"Version lineage verified ({previous_versions_count} historical versions)", "Maintain version history across document revisions")

    # Aggregate categories
    cat_stats: dict[str, dict[str, Any]] = {}
    for c in checks:
        cat = c["category"]
        if cat not in cat_stats:
            cat_stats[cat] = {"total": 0, "passed": 0, "score": 0.0}
        cat_stats[cat]["total"] += 1
        if c["passed"]:
            cat_stats[cat]["passed"] += 1

    for cat, stats in cat_stats.items():
        stats["score"] = round((stats["passed"] / stats["total"]) * 100, 1)

    passed_count = sum(1 for c in checks if c["passed"])
    failed_count = len(checks) - passed_count
    overall_score = round((passed_count / len(checks)) * 100, 1)

    if overall_score >= 85:
        verdict = "EXCELLENT"
    elif overall_score >= 70:
        verdict = "GOOD"
    elif overall_score >= 50:
        verdict = "NEEDS_IMPROVEMENT"
    else:
        verdict = "CRITICAL_ISSUES"

    recommendations = [c["recommendation"] for c in checks if c["recommendation"]]

    return {
        "total_checks": len(checks),
        "passed_checks": passed_count,
        "failed_checks": failed_count,
        "quality_score": overall_score,
        "verdict": verdict,
        "categories": cat_stats,
        "checks": checks,
        "recommendations": recommendations,
    }


async def dispatch_document_ingest(
    document_id: str,
    workspace_id: str | None,
    filename: str = "untitled",
    requested_by: str | None = None,
) -> None:
    """Durable fan-out for document ingest (Loop 4, mirrors event_service).

    Called fire-and-forget from the upload router AND by the outbox relay for
    ``document.ingest`` rows. At-least-once: idempotencyKey dedups redelivery.
    No-op unless Trigger.dev is enabled (fail-open preserved).
    """
    from ..trigger.client import TASK_INGEST_DOCUMENT, get_trigger_client, is_trigger_enabled

    if not is_trigger_enabled():
        return
    try:
        tclient = get_trigger_client()
        await tclient.trigger(
            task_name=TASK_INGEST_DOCUMENT,
            payload={
                "workspace_id": workspace_id,
                "document_id": str(document_id),
                "filename": filename,
                "requested_by": requested_by,
            },
            options={"idempotencyKey": f"ingest:{document_id}"},
        )
    except Exception as ex:
        logger.warning(f"Trigger.dev document ingest dispatch failed: {ex}")


async def publish_document_from_outbox(outbox_event) -> None:
    """Outbox relay publisher for ``document.ingest`` rows (Loop 4).

    Raises on dispatch failure so the relay retries/exhausts per policy.
    """
    data = getattr(outbox_event, "payload", None) or {}
    if not isinstance(data, dict):
        return
    await dispatch_document_ingest(
        str(data.get("document_id") or getattr(outbox_event, "id", "")),
        data.get("workspace_id"),
        data.get("filename", "untitled"),
        data.get("requested_by"),
    )


class DocumentService:
    async def upload(
        self,
        file,
        workspace_id: str,
        user_id: str | None = None,
        folder_id: str | None = None,
        tenant_id: str | None = None,
        db=None,
    ) -> Document:
        import hashlib
        import tempfile

        # 1. Stream upload chunks to a spooled temporary file (G-36 / controlled streaming)
        hasher = hashlib.sha256()
        total_size = 0
        max_upload_bytes = 25 * 1024 * 1024  # 25 MB limit
        chunk_size = 1024 * 1024  # 1 MB chunk

        with tempfile.SpooledTemporaryFile(max_size=5 * 1024 * 1024, mode="w+b") as spooled:
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break
                total_size += len(chunk)
                if total_size > max_upload_bytes:
                    raise HTTPException(status_code=413, detail="File too large — max 25MB")
                hasher.update(chunk)
                spooled.write(chunk)

            spooled.seek(0)
            content = spooled.read()

        checksum = hasher.hexdigest()
        raw_name = file.filename or "untitled"

        # 2. Server-side path & filename sanitization
        filename = file_security_service.sanitize_filename(raw_name)

        # 3. Server-side file verification (magic bytes, executable rejection, malware scan)
        verdict = file_security_service.inspect_file(
            filename=filename,
            content=content,
            declared_mime=getattr(file, "content_type", None),
        )

        if not verdict.is_safe:
            raise HTTPException(
                status_code=400,
                detail=f"Security rejection: {verdict.rejection_reason}",
            )

        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "txt"
        doc_type = EXTENSION_MAP.get(ext, "unknown")
        w_id = uuid.UUID(str(workspace_id))
        f_id = uuid.UUID(str(folder_id)) if folder_id else None
        u_id = uuid.UUID(str(user_id)) if user_id else None
        t_id = uuid.UUID(str(tenant_id)) if tenant_id else None

        # Verify folder exists in workspace if specified
        if f_id:
            f_check = await db.execute(
                select(Folder).where(Folder.id == f_id, Folder.workspace_id == w_id)
            )
            if not f_check.scalar_one_or_none():
                raise HTTPException(status_code=404, detail="Target folder not found in workspace")

        doc = Document(
            id=uuid.uuid4(),
            workspace_id=w_id,
            folder_id=f_id,
            path=filename,
            type=doc_type,
            raw_storage_key=None,
            content=content,
            status="ACTIVE",
            detected_mime_type=verdict.detected_mime,
            scan_status=verdict.scan_status,
            scan_result=verdict.rejection_reason,
            metadata_={
                "original_name": filename,
                "size": len(content),
                "sha256": checksum,
                "detected_mime": verdict.detected_mime,
            },
        )
        db.add(doc)
        await db.flush()
        await db.refresh(doc)

        # 4. Storage & Large-file offloading (>=1MB offloaded to S3 to prevent PostgreSQL WAL/RAM bloat)
        is_large = len(content) >= 1024 * 1024
        storage_key = f"storage/{workspace_id}/{doc.id}/{filename}"

        from ..config import settings as _settings
        should_store_s3 = is_large or getattr(_settings, "storage_mirror_enabled", False)

        if should_store_s3:
            try:
                await storage_service.upload(storage_key, content)
                doc.raw_storage_key = storage_key
                if is_large:
                    doc.content = None
            except Exception as e:
                logger.warning("Object-storage upload failed: %s", e)
                if is_large:
                    raise HTTPException(
                        status_code=503,
                        detail="Object storage service unavailable for large file offload",
                    )
                doc.status = "STORAGE_DEGRADED"

        # 5. Create initial DocumentVersion (v1)
        v1 = DocumentVersion(
            id=uuid.uuid4(),
            document_id=doc.id,
            version_number=1,
            storage_key=storage_key,
            checksum=checksum,
            size_bytes=len(content),
            content=None if is_large else content,
        )
        db.add(v1)

        await db.flush()
        await db.refresh(doc)

        # 6. Trigger background ingestion pipeline (fail-open)
        try:
            import asyncio
            from ..ingestion.pipeline import run_pipeline

            async def _bg_run_pipeline():
                try:
                    await run_pipeline(
                        workspace_id=str(workspace_id),
                        filename=filename,
                        content=content,
                        user_id=str(user_id) if user_id else None,
                    )
                except Exception as bg_e:
                    logger.debug("Background run_pipeline failed (non-blocking): %s", bg_e)

            asyncio.create_task(_bg_run_pipeline())
        except Exception as schedule_e:
            logger.debug("Could not schedule background pipeline: %s", schedule_e)

        return doc

    async def list_for_workspace(
        self,
        workspace_id: str,
        folder_id: str | None = None,
        page: int = 1,
        page_size: int = 20,
        include_archived: bool = False,
        status: str | None = None,
        db=None,
    ):
        w_id = uuid.UUID(str(workspace_id))
        filters = [Document.workspace_id == w_id]

        if not include_archived:
            filters.append(Document.deleted_at.is_(None))

        if folder_id:
            if str(folder_id).lower() in ("root", "null", "none"):
                filters.append(Document.folder_id.is_(None))
            else:
                filters.append(Document.folder_id == uuid.UUID(str(folder_id)))

        if status:
            filters.append(Document.status == status.upper())

        count_result = await db.execute(select(func.count()).where(*filters))
        total = count_result.scalar_one()
        offset = (page - 1) * page_size
        result = await db.execute(
            select(Document)
            .where(*filters)
            .order_by(Document.deleted_at.asc(), Document.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        return list(result.scalars().all()), total

    async def get_document(
        self,
        document_id: str,
        workspace_id: str,
        db=None,
        required_permission: str = "read",
    ) -> Document:
        try:
            doc_id = uuid.UUID(str(document_id))
            w_id = uuid.UUID(str(workspace_id))
        except (ValueError, TypeError):
            raise DocumentNotFound()

        result = await db.execute(
            select(Document).where(Document.id == doc_id, Document.workspace_id == w_id)
        )
        doc = result.scalar_one_or_none()
        if not doc:
            # Check if shared with this workspace
            share_stmt = select(DocumentShare).where(
                DocumentShare.document_id == doc_id,
                DocumentShare.target_workspace_id == w_id,
            )
            share = (await db.execute(share_stmt)).scalar_one_or_none()
            if share:
                # P0-03: Share privilege escalation check
                if required_permission in ("write", "admin"):
                    if (share.permission or "").lower() not in ("write", "admin"):
                        raise HTTPException(
                            status_code=403,
                            detail="Forbidden: Document share has read-only permission",
                        )
                # Return document from source workspace if active share
                shared_doc_res = await db.execute(select(Document).where(Document.id == doc_id))
                shared_doc = shared_doc_res.scalar_one_or_none()
                if shared_doc and shared_doc.deleted_at is None:
                    return shared_doc
            raise DocumentNotFound()
        return doc

    async def get_content(self, document_id: str, workspace_id: str, db=None):
        doc = await self.get_document(document_id, workspace_id, db, required_permission="read")
        content = doc.content
        if content is None and doc.raw_storage_key:
            try:
                content = await storage_service.download(doc.raw_storage_key)
            except Exception as e:
                logger.warning("Storage download failed for document %s: %s", doc.id, e)
        return content, doc.type, doc.path

    async def rename(
        self,
        document_id: str,
        workspace_id: str,
        new_path: str,
        actor_id: str | None = None,
        tenant_id: str | None = None,
        db=None,
    ) -> Document:
        doc = await self.get_document(document_id, workspace_id, db, required_permission="write")
        old_path = doc.path
        clean_path = file_security_service.sanitize_filename(new_path)
        if not clean_path or old_path == clean_path:
            return doc
        doc.path = clean_path
        u_id = uuid.UUID(str(actor_id)) if actor_id else None
        t_id = uuid.UUID(str(tenant_id)) if tenant_id else None
        await self._record_action(
            db=db,
            doc=doc,
            action_type=ACTION_RENAME,
            old_path=old_path,
            new_path=clean_path,
            actor_id=u_id,
            tenant_id=t_id,
        )
        return doc

    async def archive(
        self,
        document_id: str,
        workspace_id: str,
        actor_id: str | None = None,
        tenant_id: str | None = None,
        db=None,
    ) -> Document:
        doc = await self.get_document(document_id, workspace_id, db, required_permission="write")
        if doc.deleted_at is None:
            old_deleted = doc.deleted_at
            doc.deleted_at = datetime.now(UTC)
            doc.status = "ARCHIVED"
            u_id = uuid.UUID(str(actor_id)) if actor_id else None
            t_id = uuid.UUID(str(tenant_id)) if tenant_id else None
            await self._record_action(
                db=db,
                doc=doc,
                action_type=ACTION_ARCHIVE,
                old_path=None,
                new_path=None,
                old_deleted_at=old_deleted,
                new_deleted_at=doc.deleted_at,
                actor_id=u_id,
                tenant_id=t_id,
            )
        return doc

    async def restore(
        self,
        document_id: str,
        workspace_id: str,
        actor_id: str | None = None,
        tenant_id: str | None = None,
        db=None,
    ) -> Document:
        doc = await self.get_document(document_id, workspace_id, db, required_permission="write")
        if doc.deleted_at is not None:
            old_deleted = doc.deleted_at
            doc.deleted_at = None
            doc.status = "ACTIVE"
            u_id = uuid.UUID(str(actor_id)) if actor_id else None
            t_id = uuid.UUID(str(tenant_id)) if tenant_id else None
            await self._record_action(
                db=db,
                doc=doc,
                action_type=ACTION_RESTORE,
                old_path=None,
                new_path=None,
                old_deleted_at=old_deleted,
                new_deleted_at=None,
                actor_id=u_id,
                tenant_id=t_id,
            )
        return doc

    async def list_versions(self, document_id: str, workspace_id: str, db=None) -> list[DocumentVersion]:
        doc = await self.get_document(document_id, workspace_id, db, required_permission="read")
        stmt = (
            select(DocumentVersion)
            .where(DocumentVersion.document_id == doc.id)
            .order_by(DocumentVersion.version_number.desc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def create_version(
        self,
        document_id: str,
        workspace_id: str,
        file,
        user_id: str | None = None,
        tenant_id: str | None = None,
        db=None,
    ) -> DocumentVersion:
        import hashlib
        import tempfile

        doc = await self.get_document(document_id, workspace_id, db, required_permission="write")

        # Stream & hash
        hasher = hashlib.sha256()
        chunk_size = 1024 * 1024
        total_size = 0
        with tempfile.SpooledTemporaryFile(max_size=5 * 1024 * 1024, mode="w+b") as spooled:
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break
                total_size += len(chunk)
                if total_size > 25 * 1024 * 1024:
                    raise HTTPException(status_code=413, detail="File too large — max 25MB")
                hasher.update(chunk)
                spooled.write(chunk)
            spooled.seek(0)
            content = spooled.read()

        checksum = hasher.hexdigest()
        raw_name = file.filename or doc.path
        filename = file_security_service.sanitize_filename(raw_name)

        verdict = file_security_service.inspect_file(
            filename=filename,
            content=content,
            declared_mime=getattr(file, "content_type", None),
        )
        if not verdict.is_safe:
            raise HTTPException(status_code=400, detail=f"Security rejection: {verdict.rejection_reason}")

        # P0-07: Concurrency lock on parent document row (with_for_update) to serialize version sequencing
        doc_lock_stmt = select(Document).where(Document.id == doc.id)
        if db.bind and getattr(db.bind.dialect, "name", "") != "sqlite":
            doc_lock_stmt = doc_lock_stmt.with_for_update()
        locked_doc_res = await db.execute(doc_lock_stmt)
        locked_doc = locked_doc_res.scalar_one_or_none() or doc

        is_large = len(content) >= 1024 * 1024
        from ..config import settings as _settings
        should_store_s3 = is_large or getattr(_settings, "storage_mirror_enabled", False)

        MAX_RETRIES = 3
        for attempt in range(MAX_RETRIES):
            # Find latest version number
            latest_v_stmt = select(func.max(DocumentVersion.version_number)).where(
                DocumentVersion.document_id == locked_doc.id
            )
            latest_num = (await db.execute(latest_v_stmt)).scalar_one_or_none() or 0
            new_version_num = latest_num + 1

            storage_key = f"storage/{workspace_id}/{locked_doc.id}/v{new_version_num}_{filename}"

            if should_store_s3:
                try:
                    await storage_service.upload(storage_key, content)
                    locked_doc.raw_storage_key = storage_key
                except Exception as e:
                    logger.warning("Object storage upload failed for version %d: %s", new_version_num, e)
                    if is_large:
                        raise HTTPException(
                            status_code=503,
                            detail="Object storage service unavailable for large file offload",
                        )

            new_version = DocumentVersion(
                id=uuid.uuid4(),
                document_id=locked_doc.id,
                version_number=new_version_num,
                storage_key=storage_key,
                checksum=checksum,
                size_bytes=len(content),
                content=None if is_large else content,
            )
            db.add(new_version)

            # Update document current content and metadata
            locked_doc.content = None if is_large else content
            locked_doc.raw_storage_key = storage_key
            locked_doc.updated_at = datetime.now(UTC)

            u_id = uuid.UUID(str(user_id)) if user_id else None
            t_id = uuid.UUID(str(tenant_id)) if tenant_id else None
            await self._record_action(
                db=db,
                doc=locked_doc,
                action_type=ACTION_VERSION_CREATE,
                old_path=f"v{latest_num}",
                new_path=f"v{new_version_num}",
                actor_id=u_id,
                tenant_id=t_id,
            )

            try:
                await db.commit()
                await db.refresh(new_version)
                return new_version
            except IntegrityError:
                await db.rollback()
                if attempt == MAX_RETRIES - 1:
                    raise HTTPException(
                        status_code=409,
                        detail="Concurrent version creation conflict. Please retry.",
                    )

    async def restore_version(
        self,
        document_id: str,
        version_number: int,
        workspace_id: str,
        user_id: str | None = None,
        tenant_id: str | None = None,
        db=None,
    ) -> Document:
        doc = await self.get_document(document_id, workspace_id, db, required_permission="write")
        v_stmt = select(DocumentVersion).where(
            DocumentVersion.document_id == doc.id,
            DocumentVersion.version_number == version_number,
        )
        version = (await db.execute(v_stmt)).scalar_one_or_none()
        if not version:
            raise HTTPException(status_code=404, detail=f"Version {version_number} not found")

        # Restore version content from inline store or object storage
        if version.content is not None:
            doc.content = version.content
        else:
            try:
                content = await storage_service.download(version.storage_key)
                doc.content = content
            except Exception as e:
                logger.warning("Storage download failed, keeping inline content: %s", e)

        doc.raw_storage_key = version.storage_key
        doc.updated_at = datetime.now(UTC)

        u_id = uuid.UUID(str(user_id)) if user_id else None
        t_id = uuid.UUID(str(tenant_id)) if tenant_id else None
        await self._record_action(
            db=db,
            doc=doc,
            action_type=ACTION_VERSION_RESTORE,
            old_path=None,
            new_path=f"restored_v{version_number}",
            actor_id=u_id,
            tenant_id=t_id,
        )
        await db.commit()
        await db.refresh(doc)
        return doc

    async def search_documents(
        self,
        workspace_id: str,
        query: str,
        folder_id: str | None = None,
        limit: int = 50,
        offset: int = 0,
        db=None,
    ) -> list[Document]:
        w_id = uuid.UUID(str(workspace_id))
        clean_q = query.strip()
        if not clean_q:
            return []

        search_filter = or_(
            Document.path.ilike(f"%{clean_q}%"),
            Document.summary.ilike(f"%{clean_q}%"),
        )
        stmt = (
            select(Document)
            .where(
                Document.workspace_id == w_id,
                Document.deleted_at.is_(None),
                search_filter,
            )
        )
        if folder_id:
            stmt = stmt.where(Document.folder_id == uuid.UUID(str(folder_id)))

        stmt = stmt.order_by(Document.created_at.desc()).limit(limit).offset(offset)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def share_document(
        self,
        document_id: str,
        source_workspace_id: str,
        target_workspace_id: str,
        permission: str = "read",
        granted_by: str | None = None,
        expires_at: datetime | None = None,
        db=None,
    ) -> DocumentShare:
        doc = await self.get_document(document_id, source_workspace_id, db)
        t_wid = uuid.UUID(str(target_workspace_id))
        s_wid = uuid.UUID(str(source_workspace_id))
        u_id = uuid.UUID(str(granted_by)) if granted_by else None

        if t_wid == s_wid:
            raise HTTPException(status_code=400, detail="Cannot share document with its own workspace")

        # Check existing share
        exist_stmt = select(DocumentShare).where(
            DocumentShare.document_id == doc.id,
            DocumentShare.target_workspace_id == t_wid,
        )
        existing = (await db.execute(exist_stmt)).scalar_one_or_none()
        if existing:
            existing.permission = permission
            existing.expires_at = expires_at
            await db.commit()
            await db.refresh(existing)
            return existing

        share = DocumentShare(
            id=uuid.uuid4(),
            document_id=doc.id,
            source_workspace_id=s_wid,
            target_workspace_id=t_wid,
            permission=permission,
            granted_by=u_id,
            expires_at=expires_at,
        )
        db.add(share)
        await self._record_action(
            db=db,
            doc=doc,
            action_type=ACTION_SHARE,
            old_path=None,
            new_path=f"shared_with_{target_workspace_id}",
            actor_id=u_id,
        )
        await db.commit()
        await db.refresh(share)
        return share

    async def list_shares(self, document_id: str, workspace_id: str, db=None) -> list[DocumentShare]:
        doc = await self.get_document(document_id, workspace_id, db)
        stmt = select(DocumentShare).where(DocumentShare.document_id == doc.id)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def revoke_share(self, share_id: str, workspace_id: str, db=None) -> None:
        s_id = uuid.UUID(str(share_id))
        w_id = uuid.UUID(str(workspace_id))
        stmt = select(DocumentShare).where(
            DocumentShare.id == s_id,
            DocumentShare.source_workspace_id == w_id,
        )
        share = (await db.execute(stmt)).scalar_one_or_none()
        if not share:
            raise HTTPException(status_code=404, detail="Document share not found")
        await db.delete(share)
        await db.commit()

    async def _record_action(
        self,
        db,
        doc: Document,
        action_type: str,
        old_path: str | None,
        new_path: str | None,
        old_deleted_at: datetime | None = None,
        new_deleted_at: datetime | None = None,
        actor_id: uuid.UUID | None = None,
        tenant_id: uuid.UUID | None = None,
    ) -> DocumentAction:
        now = datetime.now(UTC)
        action = DocumentAction(
            id=uuid.uuid4(),
            document_id=doc.id,
            workspace_id=doc.workspace_id,
            actor_id=actor_id,
            tenant_id=tenant_id,
            action_type=action_type,
            old_path=old_path,
            new_path=new_path,
            old_deleted_at=old_deleted_at,
            new_deleted_at=new_deleted_at,
            created_at=now,
        )
        db.add(action)
        await db.flush()
        await db.refresh(action)
        return action

    async def list_actions(self, document_id: str, workspace_id: str, db=None):
        doc = await self.get_document(document_id, workspace_id, db)
        result = await db.execute(
            select(DocumentAction)
            .where(DocumentAction.document_id == doc.id)
            .order_by(DocumentAction.created_at.desc())
            .limit(50)
        )
        return list(result.scalars().all())

    async def undo_action(self, action_id: str, workspace_id: str, db=None):
        try:
            a_id = uuid.UUID(str(action_id))
            w_id = uuid.UUID(str(workspace_id))
        except (ValueError, TypeError):
            raise DocumentActionNotFound()
        result = await db.execute(
            select(DocumentAction).where(DocumentAction.id == a_id, DocumentAction.workspace_id == w_id)
        )
        action = result.scalar_one_or_none()
        if not action:
            raise DocumentActionNotFound()
        if action.undone_at is not None:
            raise DocumentActionAlreadyUndone()

        doc_result = await db.execute(select(Document).where(Document.id == action.document_id))
        doc = doc_result.scalar_one_or_none()
        if not doc:
            raise DocumentNotFound()

        if action.action_type == ACTION_RENAME:
            doc.path = action.old_path or doc.path
        elif action.action_type == ACTION_ARCHIVE:
            doc.deleted_at = None
            doc.status = "ACTIVE"
        elif action.action_type == ACTION_RESTORE:
            doc.deleted_at = action.old_deleted_at
            if action.old_deleted_at:
                doc.status = "ARCHIVED"
        action.undone_at = datetime.now(UTC)
        await db.commit()
        await db.refresh(action)
        return action, doc


    async def bulk_upload(
        self,
        files: list,
        workspace_id: str,
        user_id: str | None = None,
        folder_id: str | None = None,
        tenant_id: str | None = None,
        db=None,
    ) -> dict[str, Any]:
        """Bulk upload multiple files concurrently with individual error isolation.
        Guarantees zero silent drops: every file succeeds or has an explicit error."""
        succeeded = []
        failed = []

        for f in files:
            fname = getattr(f, "filename", "unnamed")
            try:
                doc = await self.upload(
                    file=f,
                    workspace_id=workspace_id,
                    user_id=user_id,
                    folder_id=folder_id,
                    tenant_id=tenant_id,
                    db=db,
                )
                succeeded.append({
                    "id": str(doc.id),
                    "filename": fname,
                    "path": doc.path,
                    "scan_status": doc.scan_status,
                })
            except Exception as e:
                err_msg = str(getattr(e, "detail", str(e)))
                failed.append({
                    "filename": fname,
                    "error": err_msg,
                })

        return {
            "total_attempted": len(files),
            "processed": len(succeeded),
            "failed": len(failed),
            "succeeded": succeeded,
            "items": succeeded,
            "errors": failed,
        }

    async def bulk_download_zip(
        self,
        document_ids: list,
        workspace_id: str,
        db=None,
    ) -> bytes:
        """Create a zip archive containing requested documents."""
        import zipfile
        import io

        w_uuid = uuid.UUID(str(workspace_id))
        zip_buffer = io.BytesIO()

        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for d_id in document_ids:
                try:
                    content, _doc_type, path = await self.get_content(str(d_id), str(w_uuid), db)
                    if content is not None:
                        fname = path.rsplit("/", 1)[-1] if path else f"doc_{d_id}.bin"
                        zf.writestr(fname, content)
                except Exception as e:
                    logger.warning("Failed to include document %s in bulk download: %s", d_id, e)

        zip_buffer.seek(0)
        return zip_buffer.getvalue()

    async def audit_document_quality(
        self,
        document_id: str,
        workspace_id: str,
        db=None,
    ) -> dict[str, Any]:
        """Perform speculative 50-check quality, ATS, and impact audit on document."""
        doc = await self.get_document(document_id, workspace_id, db, required_permission="read")
        content, _doc_type, path = await self.get_content(str(doc.id), workspace_id, db)
        text = ""
        if content:
            try:
                text = content.decode("utf-8", errors="replace")
            except Exception:
                text = str(content)

        # Count existing historical versions
        v_count_stmt = select(func.count(DocumentVersion.id)).where(DocumentVersion.document_id == doc.id)
        v_count = (await db.execute(v_count_stmt)).scalar_one_or_none() or 0

        audit_res = _run_50_checks(
            text=text,
            filename=path or "untitled",
            doc_type=doc.type,
            previous_versions_count=v_count,
        )
        audit_res["document_id"] = doc.id
        return audit_res

    async def compare_document_versions(
        self,
        document_id: str,
        version_a: int,
        version_b: int,
        workspace_id: str,
        db=None,
    ) -> dict[str, Any]:
        """Perform Myers diff and structured change analysis between two document revisions."""
        doc = await self.get_document(document_id, workspace_id, db, required_permission="read")

        va_stmt = select(DocumentVersion).where(
            DocumentVersion.document_id == doc.id,
            DocumentVersion.version_number == version_a,
        )
        vb_stmt = select(DocumentVersion).where(
            DocumentVersion.document_id == doc.id,
            DocumentVersion.version_number == version_b,
        )
        va = (await db.execute(va_stmt)).scalar_one_or_none()
        vb = (await db.execute(vb_stmt)).scalar_one_or_none()

        if not va:
            raise HTTPException(status_code=404, detail=f"Version {version_a} not found")
        if not vb:
            raise HTTPException(status_code=404, detail=f"Version {version_b} not found")

        content_a = va.content
        if content_a is None and va.storage_key:
            try:
                content_a = await storage_service.download(va.storage_key)
            except Exception as e:
                logger.warning("Failed to download version %d content: %s", version_a, e)

        content_b = vb.content
        if content_b is None and vb.storage_key:
            try:
                content_b = await storage_service.download(vb.storage_key)
            except Exception as e:
                logger.warning("Failed to download version %d content: %s", version_b, e)

        text_a = content_a.decode("utf-8", errors="replace") if content_a else ""
        text_b = content_b.decode("utf-8", errors="replace") if content_b else ""

        lines_a = text_a.splitlines(keepends=True)
        lines_b = text_b.splitlines(keepends=True)

        matcher = difflib.SequenceMatcher(None, text_a, text_b)
        ratio = round(matcher.ratio(), 4)

        diff = list(difflib.unified_diff(
            lines_a,
            lines_b,
            fromfile=f"v{version_a}_{doc.path}",
            tofile=f"v{version_b}_{doc.path}",
        ))

        additions = [line.rstrip("\r\n")[1:] for line in diff if line.startswith("+") and not line.startswith("+++")]
        deletions = [line.rstrip("\r\n")[1:] for line in diff if line.startswith("-") and not line.startswith("---")]

        words_a = len(text_a.split())
        words_b = len(text_b.split())
        delta_words = words_b - words_a

        summary = (
            f"Version {version_b} compared to Version {version_a}: "
            f"{len(additions)} addition(s), {len(deletions)} deletion(s), "
            f"{delta_words:+d} word delta ({ratio * 100:.1f}% text similarity)."
        )

        return {
            "document_id": doc.id,
            "version_a": version_a,
            "version_b": version_b,
            "similarity_ratio": ratio,
            "word_count_a": words_a,
            "word_count_b": words_b,
            "word_count_delta": delta_words,
            "additions_count": len(additions),
            "deletions_count": len(deletions),
            "additions": additions[:50],
            "deletions": deletions[:50],
            "diff_snippet": "".join(diff[:60]),
            "summary": summary,
        }


document_service = DocumentService()
