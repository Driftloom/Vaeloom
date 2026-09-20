#!/usr/bin/env python3
"""
Vaeloom Interview & Salary Intelligence Co-Pilot Demo.

Demonstrates:
1. Deterministic Salary Benchmarking (P25, Median, P75, P90 percentiles by role and geography).
2. Offer Analysis & Counter-Offer Strategy Generator.
3. STAR Method (Situation, Task, Action, Result) Mock Interview Response Evaluator.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parents[2]
for path_dir in [ROOT]:
    if str(path_dir) not in sys.path:
        sys.path.insert(0, str(path_dir))
for pkg in (ROOT / "packages").glob("*/src"):
    if str(pkg) not in sys.path:
        sys.path.insert(0, str(pkg))

from examples.demo_common.data import SAMPLE_CANDIDATE, SALARY_BENCHMARKS
from vaeloom_domain.salary import estimate_salary_benchmark, SalaryBenchmark


class STARInterviewEvaluator:
    """Evaluates candidate interview response quality using the STAR framework."""

    @staticmethod
    def evaluate_response(question: str, response: str) -> dict[str, Any]:
        resp_lower = response.lower()

        # Situation: project scale, context, stakes
        situation_words = ["system", "datacenter", "production", "traffic", "outage", "team", "client", "cluster"]
        has_situation = sum(1 for w in situation_words if w in resp_lower) >= 2
        situation_score = 25 if has_situation else 12

        # Task: goal, objective, constraint
        task_words = ["needed to", "responsible for", "goal was", "task was", "objective", "had to", "decided to"]
        has_task = any(w in resp_lower for w in task_words)
        task_score = 25 if has_task else 10

        # Action: concrete engineering actions, algorithms, languages
        action_words = ["architected", "implemented", "debugged", "profiled", "engineered", "refactored", "ebpf", "raft", "rust", "go", "isolated"]
        has_action = sum(1 for w in action_words if w in resp_lower) >= 2
        action_score = 25 if has_action else 14

        # Result: quantified numbers, percentages, latency, uptime
        quantifiers = re.findall(r"\b\d+[%ms|k|mb|gb|tb|x]?\b", resp_lower)
        result_words = ["reduced", "slashed", "improved", "saved", "achieved", "restored", "zero downtime"]
        has_result = len(quantifiers) >= 2 and any(w in resp_lower for w in result_words)
        result_score = 25 if has_result else 12

        total = situation_score + task_score + action_score + result_score

        feedback = []
        if situation_score < 20:
            feedback.append("Clarify the initial situation and business stakes upfront.")
        if task_score < 20:
            feedback.append("Explicitly articulate your primary objective and constraints.")
        if action_score < 20:
            feedback.append("Highlight specific individual engineering actions rather than team generalities.")
        if result_score < 20:
            feedback.append("Quantify business and engineering results with specific metrics (e.g. % latency cut, $ saved).")
        if not feedback:
            feedback.append("Exemplary STAR narrative with crisp problem framing and quantified impact.")

        return {
            "question": question,
            "overall_score": total,
            "breakdown": {
                "situation": f"{situation_score}/25",
                "task": f"{task_score}/25",
                "action": f"{action_score}/25",
                "result": f"{result_score}/25",
            },
            "feedback": feedback,
            "is_interview_ready": total >= 80,
        }


def generate_counter_offer_strategy(
    candidate_name: str,
    target_role: str,
    location: str,
    initial_base: int,
    initial_equity: int,
) -> dict[str, Any]:
    """Computes percentile alignment and prepares a structured counter-offer script."""
    bench = SALARY_BENCHMARKS.get(target_role, {}).get(location)
    if not bench:
        domain_bench = estimate_salary_benchmark(target_role, location)
        bench = {
            "p25": domain_bench.p25,
            "p50": domain_bench.median,
            "p75": domain_bench.p75,
            "p90": domain_bench.p90,
        }

    total_offered = initial_base + initial_equity
    target_p75 = bench["p75"]
    target_p90 = bench["p90"]

    counter_base = max(initial_base, int(bench["p75"] * 0.95))
    counter_equity = max(initial_equity, int(bench["p75"] * 0.35))
    target_total = counter_base + counter_equity

    script = (
        f"Thank you for the offer for the {target_role} position. Based on my 8+ years "
        f"architecting low-latency distributed state machines, recent peer offers in {location}, "
        f"and market 75th-percentile data for Staff levels (${bench['p75']:,}), I would like to "
        f"request a base salary of ${counter_base:,} and an annual equity grant of ${counter_equity:,}, "
        f"bringing total compensation to ${target_total:,}."
    )

    return {
        "market_benchmarks": bench,
        "current_offer": {
            "base": initial_base,
            "equity": initial_equity,
            "total": total_offered,
        },
        "counter_proposal": {
            "proposed_base": counter_base,
            "proposed_equity": counter_equity,
            "proposed_total": target_total,
            "percentile_target": "75th-85th Percentile",
        },
        "negotiation_script": script,
    }


def run_interview_intelligence_demo():
    print("=" * 76)
    print("     VAELOOM INTERVIEW PREPARATION & SALARY INTELLIGENCE DEMO")
    print("=" * 76)

    candidate = SAMPLE_CANDIDATE
    role = "Staff Distributed Systems Engineer"
    location = "San Francisco, CA"

    print(f"\n[1] Market Compensation Intelligence:")
    print(f"    Target Role:     {role}")
    print(f"    Primary Market:  {location}")

    domain_bench: SalaryBenchmark = estimate_salary_benchmark("staff_software_engineer", "US_SF")
    print(f"    Industry Median: ${domain_bench.median:,} USD")
    print(f"    P25 / P90 Range: ${domain_bench.p25:,} - ${domain_bench.p90:,} USD")

    # Offer Analysis
    print("\n[2] Offer Analysis & Negotiation Strategy:")
    print("-" * 76)
    initial_offer_base = 225000
    initial_offer_equity = 45000
    strategy = generate_counter_offer_strategy(
        candidate_name=candidate["name"],
        target_role=role,
        location=location,
        initial_base=initial_offer_base,
        initial_equity=initial_offer_equity,
    )

    print(f"  Initial Offer:   Base ${initial_offer_base:,} + Equity ${initial_offer_equity:,} = Total ${strategy['current_offer']['total']:,}")
    print(f"  Market P75 Band: ${strategy['market_benchmarks']['p75']:,}")
    print(f"  Counter Target:  Base ${strategy['counter_proposal']['proposed_base']:,} + Equity ${strategy['counter_proposal']['proposed_equity']:,} = Total ${strategy['counter_proposal']['proposed_total']:,}")
    print(f"\n  [Negotiation Script]:\n  \"{strategy['negotiation_script']}\"")

    # STAR Mock Interview Evaluation
    print("\n[3] STAR Framework Mock Interview Evaluation:")
    print("-" * 76)
    question = "Describe a high-stakes distributed systems failure and how you resolved it."
    candidate_answer = (
        "During a peak traffic surge at Apex Cloud Systems, our 5-node Raft consensus cluster "
        "experienced asymmetric network partition, causing leader flapping and latency spikes. "
        "As the lead systems engineer, I needed to restore consensus without data loss. "
        "I engineered an eBPF filter to immediately isolate Byzantine heartbeat packets, patched the "
        "lease expiration timers in our Rust codebase, and orchestrated a rolling restart. "
        "Within 12 minutes, consensus was stabilized, reducing P99 latency by 48% with zero dropped transactions."
    )

    eval_result = STARInterviewEvaluator.evaluate_response(question, candidate_answer)

    print(f"Question: \"{eval_result['question']}\"")
    print(f"Candidate Answer: \"{candidate_answer}\"")
    print(f"\nEvaluation Outcome: {eval_result['overall_score']}/100 [PASS - READY FOR ONSITE]")
    print(f"  - Situation: {eval_result['breakdown']['situation']}")
    print(f"  - Task:      {eval_result['breakdown']['task']}")
    print(f"  - Action:    {eval_result['breakdown']['action']}")
    print(f"  - Result:    {eval_result['breakdown']['result']}")
    print(f"  - Feedback:  {eval_result['feedback'][0]}")

    print("\n" + "=" * 76)
    print("  INTERVIEW & SALARY INTELLIGENCE DEMO COMPLETED SUCCESSFULLY")
    print("=" * 76)


if __name__ == "__main__":
    run_interview_intelligence_demo()
