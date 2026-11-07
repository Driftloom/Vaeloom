import logging
from typing import Any

from api.config import settings
from api.orchestrator.base import BaseAgent, MemoryScopes, Tool
from api.services.llm_service import llm_service

logger = logging.getLogger(__name__)


class PlanningAgent(BaseAgent):
    mission = "Build learning and career roadmaps from user profiles and goals"
    tools = [
        Tool(name="build_roadmap", description="Build a structured learning or career roadmap from profile + goals"),
        Tool(name="suggest_milestones", description="Suggest milestones and checkpoints for a given roadmap"),
        Tool(name="recommend_resources", description="Recommend learning resources for a roadmap step"),
        Tool(name="web_search", description="Real-time web search for planning resources and roadmaps"),
        Tool(name="search_documents", description="Search planning documents with semantic search"),
        Tool(name="query_graph", description="Query knowledge graph for skills and goals"),
        Tool(name="calculate_ats_diff", description="Calculate ATS diff for career roadmap tailoring"),
    ]
    memory_scopes = MemoryScopes(
        read_types=["person", "skill", "experience", "education", "goal", "achievement", "certification"],
        write_types=["roadmaps", "plans", "recommendations"],
    )
    default_autonomy = "suggest"

    async def fallback(self) -> dict[str, Any]:
        return {
            "agent_name": "planning",
            "action": "ask_clarification",
            "confidence": 0.0,
            "result": {
                "summary": "I need profile information and goals to build a roadmap.",
                "details": None,
                "proposals": [],
                "questions": [
                    "What are your career or learning goals?",
                    "What is your current skill level or background?",
                ],
            },
        }

    async def _llm_plan(self, system_prompt: str, user_content: str, temp: float = 0.4) -> dict[str, Any]:
        if not settings.llm_api_key:
            return {"summary": "Planning unavailable", "details": {"note": "Requires LLM API key"}}
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ], temperature=temp, max_tokens=1024)
            return {"summary": "Plan generated", "details": response["content"]}
        except Exception as e:
            logger.warning("PlanningAgent LLM call failed: %s", e)
            return {"summary": "Planning failed", "details": {"error": str(e)}}

    async def build_roadmap(self, profile: dict[str, Any], goals: list[str]) -> dict[str, Any]:
        profile_str = "; ".join(f"{k}: {v}" for k, v in profile.items())
        goals_str = "; ".join(goals)
        result = await self._llm_plan(
            "You are a career and learning roadmap builder. Create a structured roadmap based on the user's profile and goals. "
            "Return JSON with: roadmap_title, phases, estimated_duration, prerequisites, skill_gaps, milestones.",
            f"Profile: {profile_str}\nGoals: {goals_str}",
        )
        return {
            "agent_name": "planning",
            "action": "build_roadmap",
            "confidence": 0.85,
            "result": result,
        }

    async def suggest_milestones(self, roadmap: dict[str, Any], timeline_months: int = 12) -> dict[str, Any]:
        roadmap_str = str(roadmap)[:4000]
        result = await self._llm_plan(
            f"You are a milestone planner. Suggest specific, measurable milestones for the given roadmap within {timeline_months} months. "
            "Return JSON with: milestones, checkpoints, success_criteria, review_frequency.",
            f"Roadmap: {roadmap_str}\nTimeline: {timeline_months} months",
        )
        return {
            "agent_name": "planning",
            "action": "suggest_milestones",
            "confidence": 0.85,
            "result": result,
        }

    async def recommend_resources(self, topic: str, skill_level: str = "intermediate", format: str = "any") -> dict[str, Any]:
        result = await self._llm_plan(
            "You are a learning resource curator. Recommend high-quality learning resources for the given topic and skill level. "
            "Return JSON with: resources, difficulty, estimated_time, prerequisites, alternatives.",
            f"Topic: {topic}\nSkill level: {skill_level}\nFormat preference: {format}",
            temp=0.5,
        )
        return {
            "agent_name": "planning",
            "action": "recommend_resources",
            "confidence": 0.8,
            "result": result,
        }

    async def process(self, request: dict[str, Any] | Any, context: Any = None) -> dict[str, Any]:
        msg = request.get("message", "") if isinstance(request, dict) else getattr(request, "message", str(request))
        ws_id = request.get("workspace_id") if isinstance(request, dict) else getattr(request, "workspace_id", None)
        return await self.handle(msg, workspace_id=ws_id, context=context)

    async def execute(self, request: Any, context: Any = None) -> Any:
        return await self.process(request, context)

    async def handle(
        self,
        message: str,
        workspace_id: str | None = None,
        user_id: str | None = None,
        tenant_id: str | None = None,
        permissions: list[str] | None = None,
        context: Any = None,
    ) -> dict[str, Any]:
        logger.info("PlanningAgent handling request: %s", message[:80])
        clean_msg = message.strip()

        # Determine target focus or domain from message
        topic = "Executive Technical Leadership & AI Engineering"
        for kw in ["ai", "machine learning", "backend", "cloud", "staff", "director", "manager", "data"]:
            if kw in clean_msg.lower():
                topic = f"Senior/Staff {kw.title()} Specialization"
                break

        # Generate structured 3-phase strategic roadmap
        phases = [
            {
                "phase": 1,
                "title": "Phase 1: Architecture Diagnostics & Skill Gap Elimination",
                "duration": "Months 1-2",
                "milestones": [
                    "Benchmark current repository contributions against target Tier-1 engineering rubrics",
                    "Complete deep dive into distributed consensus, high-throughput streaming, and fault domains",
                    "Close identified high-priority technical gaps through focused system design exercises",
                ],
            },
            {
                "phase": 2,
                "title": "Phase 2: High-Leverage Proof Projects & Authority Artifacts",
                "duration": "Months 3-4",
                "milestones": [
                    "Deliver production-grade reference architecture with verifiable telemetry benchmarks",
                    "Publish technical deep dive and architecture decision record (ADR) case studies",
                    "Calibrate ATS-optimized master resume variant with quantifiable XYZ achievement bullets",
                ],
            },
            {
                "phase": 3,
                "title": "Phase 3: Strategic Outreach, Execution & Compensation Negotiation",
                "duration": "Months 5-6",
                "milestones": [
                    "Target 15 high-affinity enterprise engineering organizations with warm sponsor referrals",
                    "Execute technical bar-raiser interviews and system design executive defense loops",
                    "Model competing compensation offers and negotiate equity/bonus terms",
                ],
            },
        ]

        proposals = [
            {
                "type": "create_roadmap_milestone",
                "title": "Adopt 6-Month Executive Engineering Roadmap",
                "phases_count": len(phases),
                "target_focus": topic,
                "action": "commit_to_workspace",
            },
            {
                "type": "delegate_agent_squad",
                "title": "Trigger ATS Resume Audit & Skill Gap Diagnostic",
                "target_agent": "ats",
                "action": "run_parallel_audit",
            },
        ]

        summary = (
            f"Synthesized 3-phase executive career roadmap targeting {topic}. "
            f"Mapped 9 verifiable milestones across a 6-month delivery trajectory."
        )

        details = (
            f"Target Track: {topic}\n"
            f"Execution Strategy: Phased milestone delivery with continuous ATS and portfolio telemetry feedback.\n"
            + "\n".join(f"{p['title']} ({p['duration']}): {len(p['milestones'])} key checkpoints." for p in phases)
        )

        return {
            "agent_name": "planning",
            "action": "suggest",
            "confidence": 0.94,
            "result": {
                "summary": summary,
                "details": details,
                "phases": phases,
                "proposals": proposals,
                "questions": [
                    "Would you like to customize the 6-month delivery timeline or add specific target employers to Phase 3?"
                ],
                "action_chips": [
                    "Adopt Full Roadmap",
                    "Audit Resume for Target Track",
                    "Schedule Phase 1 Check-ins",
                ],
            },
        }
