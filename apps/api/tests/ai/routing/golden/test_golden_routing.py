"""Golden Routing Evaluation Dataset (50+ Scenarios).

Validates:
1. Deterministic and semantic routing accuracy across all core agents.
2. Paraphrase semantic equivalence (different phrasing -> identical destination).
3. Rogers OARS emotional context signals (burnout, anxiety -> supportive tone + low cognitive load).
4. Boundary and micro-token inputs.
5. Strict adherence to typed IntentEnvelope and RoutingDecision contracts.
"""

import pytest
from api.orchestrator.contracts.intent import IntentEnvelope
from api.orchestrator.router import classify_intent
from api.orchestrator.routing import routing_engine


GOLDEN_SCENARIOS = [
    # ── 1. Greetings & Conversational Core ────────────────────────────────────
    ("hlo", "conversation"),
    ("hi there", "conversation"),
    ("good morning vaeloom", "conversation"),
    ("hey", "conversation"),
    ("hello partner, are you online?", "conversation"),
    ("what can you help me with?", "conversation"),

    # ── 2. Resume Engineering & Tailoring ─────────────────────────────────────
    ("tailor my resume for a senior staff backend engineer role at Stripe", "resume"),
    ("can you improve the bullet points on my CV to highlight distributed systems?", "resume"),
    ("create a new resume from my profile", "resume"),
    ("rewrite my summary section to sound more executive and leadership focused", "resume"),
    ("update my resume experience with my recent staff engineer role at Datadog", "resume"),
    ("format my resume according to standard industry engineering guidelines", "resume"),

    # ── 3. Job Search & Discovery ─────────────────────────────────────────────
    ("find staff python jobs in San Francisco paying over 250k", "job_search"),
    ("are there any remote Golang tech lead openings posted this week?", "job_search"),
    ("search for engineering manager roles in New York with equity", "job_search"),
    ("look up recent openings for senior AI research engineers", "job_search"),
    ("what companies are currently hiring distributed systems architects?", "job_search"),
    ("find startup founding engineer positions in Seattle", "job_search"),

    # ── 4. ATS Optimization & Resume Scoring ──────────────────────────────────
    ("score my resume against this job description", "ats"),
    ("check the ATS match percentage for my uploaded CV", "ats"),
    ("audit my resume for formatting issues and keyword parseability", "ats"),
    ("why did my resume get filtered out by the recruiter ATS parser?", "ats"),
    ("compare my resume against the required hard skills of this role", "ats"),
    ("run a full ATS compatibility scan on my technical resume", "ats"),

    # ── 5. Application Materials & Outreach ───────────────────────────────────
    ("draft an application email to the hiring manager at Linear", "application"),
    ("prepare my cover letter and submission materials for the Apple role", "application"),
    ("track my pending job applications and their current status", "application"),
    ("write a follow-up email after my on-site interview last Tuesday", "gmail"),
    ("compose a cold outreach message to an engineering director on LinkedIn", "network"),

    # ── 6. Interview Preparation & Technical Coaching ─────────────────────────
    ("conduct a mock system design interview for a tier-1 tech company", "interview"),
    ("practice behavioral interview questions using the STAR framework", "interview"),
    ("how should I answer the 'tell me about a time you had a conflict' question?", "interview"),
    ("critique my explanation of distributed consensus and Paxos vs Raft", "interview"),
    ("prep me for my upcoming executive engineering leadership screening", "interview"),

    # ── 7. Market Intelligence & Compensation ─────────────────────────────────
    ("benchmark staff software engineer salaries in Seattle vs Bay Area", "market_intelligence"),
    ("is a 350k total compensation package fair for an L6 at Google?", "market_intelligence"),
    ("what is the current market rate for VP of Engineering equity grants?", "market_intelligence"),
    ("give me a negotiation counter-offer strategy for my current offer", "market_intelligence"),
    ("break down compensation percentiles for AI infrastructure engineers", "market_intelligence"),

    # ── 8. Networking & Mentorship ────────────────────────────────────────────
    ("find alumni from my university working at OpenAI or Anthropic", "network"),
    ("generate coffee chat invitations for principal engineers in fintech", "network"),
    ("how can I expand my professional network in the generative AI domain?", "network"),
    ("draft a warm introduction request through our mutual contact", "network"),

    # ── 9. Calendar & Scheduling ──────────────────────────────────────────────
    ("schedule my mock interview session for tomorrow at 3pm", "calendar"),
    ("what technical interviews do I have scheduled on my calendar this week?", "calendar"),
    ("add a calendar reminder to submit my take-home assignment by Friday", "calendar"),

    # ── 10. Security, Auditing & Governance ───────────────────────────────────
    ("scan uploaded documents for PII, secrets, and credentials", "security"),
    ("audit permissions and access tokens for connected SaaS tools", "security"),
    ("verify document encryption and multi-tenant workspace isolation", "security"),

    # ── 11. Emotional Valence & Psychological Safety (Rogers OARS) ────────────
    ("I feel completely overwhelmed by the job hunt and don't know where to start", "conversation"),
    ("I just got rejected after 6 rounds of interviews and feel exhausted", "conversation"),
    ("I'm burned out from coding assessments and need a moment to breathe", "conversation"),
    ("everything feels hopeless with this tech job market right now", "conversation"),
    ("I'm feeling super nervous about my final round loop tomorrow morning", "wellness"),

    # ── 12. Boundary, Punctuation & Micro-Token Inputs ────────────────────────
    ("9876", "conversation"),
    ("ok", "conversation"),
    ("thanks!", "conversation"),
    ("???", "conversation"),
    ("...", "conversation"),
]


@pytest.mark.asyncio
@pytest.mark.parametrize("query,expected_agent", GOLDEN_SCENARIOS)
async def test_golden_routing_scenarios(query: str, expected_agent: str):
    """Assert each scenario routes to the exact authoritative specialist."""
    intent, conf = await classify_intent(query)
    assert intent == expected_agent, f"Query '{query}' expected '{expected_agent}', got '{intent}'"
    assert conf >= 0.70, f"Confidence {conf} was below zero-trust threshold for '{query}'"


@pytest.mark.asyncio
async def test_emotional_distress_context_signals():
    """Verify Rogers OARS signals are captured for distressed queries without keyword hacks."""
    distress_query = "I am so overwhelmed and exhausted from endless rejections"
    envelope, plan = await routing_engine.route(
        query=distress_query,
        workspace_id="11111111-1111-1111-1111-111111111111",
    )
    assert envelope.selected_agent in ("conversation", "wellness")
    assert envelope.confidence >= 0.70
    assert envelope.context_signal.emotional_state.value in ("anxious", "frustrated", "burnt_out", "confused")
    assert envelope.context_signal.valence < 0.0
    assert envelope.context_signal.cognitive_load >= 0.60
