"""Test Suite: Module 05 Cost & Token Budgeting (M05-COST).
Verifies token accounting, USD cost estimation, loop budget limits, and per-workspace spending limits.
"""
import pytest
from api.orchestrator.loop_safety import LoopSafetyTracker


def test_token_budget_enforcement():
    """Verify agent loop aborts when maximum token budget is exceeded."""
    tracker = LoopSafetyTracker(max_tokens=500)
    tracker.record_tool("search_documents", tokens=250, cost_usd=0.002)
    assert tracker.check_budgets() is None

    # Exceed budget
    tracker.record_tool("get_document_content", tokens=300, cost_usd=0.003)
    assert tracker.check_budgets() == "token_budget"


def test_cost_budget_enforcement():
    """Verify agent loop aborts when USD spending budget is exceeded."""
    tracker = LoopSafetyTracker(max_cost_usd=0.02)
    tracker.record_tool("synthesize_documents", tokens=100, cost_usd=0.015)
    assert tracker.check_budgets() is None

    # Exceed cost
    tracker.record_tool("create_entity", tokens=50, cost_usd=0.01)
    assert tracker.check_budgets() == "cost_budget"


def test_infinite_loop_cycle_detection():
    """Verify LoopSafetyTracker halts infinite ping-pong or recurring tool calls."""
    tracker = LoopSafetyTracker()
    call_sig = "search_documents:query=salary"
    tracker.record_tool(call_sig)
    tracker.record_tool(call_sig)
    assert tracker.detect_cycle() is None

    # Third identical call trips cycle breaker
    tracker.record_tool(call_sig)
    assert tracker.detect_cycle() == "cycle_detected"
