"""Action Proposal Engine module alias.

Re-exports ActionProposalEngine from proposals_engine for canonical naming consistency.
"""

from .proposals_engine import ActionProposalEngine, action_proposal_engine

__all__ = ["ActionProposalEngine", "action_proposal_engine"]
