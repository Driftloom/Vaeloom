"""Hybrid Layered Routing Engine Package.

Implements the 6-layer architecture:
- Layer A: Deterministic Security & IDOR Gate
- Layer B: Cheap Semantic Candidate Generation
- Layer C: Cognitive Arbitration (TypeSafe Jev System 1 + Ollama Gemma System 2)
- Layer D: Deterministic Policy & Entitlement Gate
- Layer E: Execution Planning & Supervisor DAG
- Layer F: Autonomous Execution Runner
"""

from .engine import RoutingEngine, routing_engine
from .layer_a_safety import LayerASafetyGate
from .layer_b_semantic import LayerBSemanticCandidates
from .layer_c_arbitration import LayerCArbitration
from .layer_d_policy import LayerDPolicyGate
from .layer_e_planner import LayerEPlanner

__all__ = [
    "LayerASafetyGate",
    "LayerBSemanticCandidates",
    "LayerCArbitration",
    "LayerDPolicyGate",
    "LayerEPlanner",
    "RoutingEngine",
    "routing_engine",
]
