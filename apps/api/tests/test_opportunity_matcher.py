"""
Unit tests for PIOS Opportunity Engine (matcher_core).
Tests 4-factor formula: cosine * proximity * recency - gap_penalty
"""
import pytest

from api.services.opportunity_matcher import (
    OpportunityMatcher,
    opportunity_matcher,
)


def test_matcher_core_high_alignment():
    user_capabilities = [
        {
            "name": "Python",
            "effective_confidence": 0.95,
            "validation_tier": "V3",
            "decay_factor": 0.98,
            "decay_status": "fresh",
        },
        {
            "name": "FastAPI",
            "effective_confidence": 0.92,
            "validation_tier": "V2",
            "decay_factor": 0.95,
            "decay_status": "fresh",
        },
        {
            "name": "PostgreSQL",
            "effective_confidence": 0.88,
            "validation_tier": "V2",
            "decay_factor": 0.90,
            "decay_status": "fresh",
        },
    ]

    opportunity = {
        "id": "job-101",
        "title": "Senior Backend Engineer",
        "company": "Driftloom Core",
        "type": "job",
        "required_skills": ["Python", "FastAPI", "PostgreSQL"],
    }

    result = opportunity_matcher.calculate_match(
        opportunity=opportunity,
        user_capabilities=user_capabilities,
        connected_entities_count=5,
    )

    assert result.opportunity_id == "job-101"
    assert result.match_score >= 0.80
    assert len(result.matching_skills) == 3
    assert len(result.missing_skills) == 0
    assert result.gap_penalty == 0.0
    assert "High Match" in result.why_you_headline
    assert "Python" in result.why_you_rationale


def test_matcher_core_with_skill_gaps():
    user_capabilities = [
        {
            "name": "Python",
            "effective_confidence": 0.9,
            "validation_tier": "V2",
            "decay_factor": 0.9,
            "decay_status": "fresh",
        },
    ]

    opportunity = {
        "id": "hackathon-202",
        "title": "Autonomous AI Agent Hackathon",
        "company": "LabLab.ai",
        "type": "hackathon",
        "required_skills": ["Python", "Docker", "Kubernetes", "PyTorch"],
    }

    result = opportunity_matcher.calculate_match(
        opportunity=opportunity,
        user_capabilities=user_capabilities,
        connected_entities_count=1,
    )

    # Missing 3 out of 4 skills -> gap penalty applied
    assert len(result.matching_skills) == 1
    assert len(result.missing_skills) == 3
    assert result.gap_penalty > 0.15
    assert result.match_score < 0.60
    assert result.development_action is not None
    assert any(sk.lower() in result.development_action.lower() for sk in ["Docker", "Kubernetes", "PyTorch"])


def test_rank_opportunities():
    user_capabilities = [
        {"name": "Python", "effective_confidence": 0.95, "decay_factor": 1.0},
        {"name": "TypeScript", "effective_confidence": 0.85, "decay_factor": 0.9},
    ]

    opps = [
        {"id": "opp-low", "title": "Rust Dev", "company": "Co A", "required_skills": ["Rust", "Wasm"]},
        {"id": "opp-high", "title": "Fullstack Engineer", "company": "Co B", "required_skills": ["Python", "TypeScript"]},
        {"id": "opp-mid", "title": "Backend Python", "company": "Co C", "required_skills": ["Python", "Go"]},
    ]

    ranked = opportunity_matcher.rank_opportunities(opps, user_capabilities, top_k=3)
    assert len(ranked) == 3
    assert ranked[0].opportunity_id == "opp-high"
    assert ranked[1].opportunity_id == "opp-mid"
    assert ranked[2].opportunity_id == "opp-low"
    assert ranked[0].match_score > ranked[1].match_score > ranked[2].match_score
