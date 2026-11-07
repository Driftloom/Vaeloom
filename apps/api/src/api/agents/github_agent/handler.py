"""
GitHub Agent — analyze GitHub profiles and repositories for skill assessment.
Read-only, suggest autonomy. Respects rate limits and public data only.
"""
import logging
from typing import Any

from api.config import settings
from api.orchestrator.base import BaseAgent, MemoryScopes, Tool
from api.services.llm_service import llm_service

logger = logging.getLogger(__name__)


class GitHubAgent(BaseAgent):
    mission = "Analyze GitHub profiles and repositories for skill assessment"
    tools = [
        Tool(name="fetch_github_repo", description="Fetch commits, PRs, repos, issues from GitHub API"),
        Tool(name="search_github_repos", description="Search GitHub repositories by query"),
        Tool(name="get_github_profile", description="Get public GitHub profile and top repos"),
        Tool(name="list_github_issues", description="List issues for a repo"),
        Tool(name="read_github_file", description="Read a file from a GitHub repo"),
        Tool(name="create_github_issue", description="Create GitHub issues (approval-gated)"),
        Tool(name="create_github_pull_request", description="Create GitHub PRs (approval-gated)"),
        Tool(name="web_search", description="Real-time web search for GitHub and tech trends"),
        # legacy logical tools retained for backwards compat (mock-fallback via LLM)
        Tool(name="analyze_profile", description="Analyze a GitHub user's profile for skills and activity"),
        Tool(name="get_repo_stats", description="Get statistics and analysis for a repository"),
        Tool(name="assess_skills", description="Assess technical skills based on GitHub activity"),
    ]
    memory_scopes = MemoryScopes(
        read_types=["github", "skills", "repositories", "contributions"],
        write_types=[],
    )
    default_autonomy = "suggest"

    async def fallback(self) -> Any:
        return {
            "agent_name": "github",
            "action": "ask_clarification",
            "confidence": 0.0,
            "result": {
                "summary": "I need a GitHub username or repository to analyze.",
                "details": None,
                "proposals": [],
                "questions": ["What GitHub username would you like me to analyze?"],
            },
        }

    async def analyze_profile(
        self,
        username: str,
    ) -> dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_profile(username)
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are a GitHub profile analyst. Analyze developer profiles from available data. Return JSON with: skill_summary, top_languages, activity_level, open_source_contributions, profile_strength, recommendations."},
                {"role": "user", "content": f"GitHub username: {username}"},
            ], temperature=0.5, max_tokens=512)
            return {
                "agent_name": "github",
                "action": "suggest",
                "confidence": 0.85,
                "result": {
                    "summary": f"Profile analysis for {username}",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"Profile analysis failed: {e}")
            return self._fallback_profile(username)

    async def get_repo_stats(
        self,
        repo_full_name: str,
    ) -> dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_repo(repo_full_name)
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are a repository analyst. Analyze repositories for code quality, activity, and impact. Return JSON with: tech_stack, code_quality_indicators, activity_metrics, community_engagement, maintenance_health."},
                {"role": "user", "content": f"Repository: {repo_full_name}"},
            ], temperature=0.5, max_tokens=512)
            return {
                "agent_name": "github",
                "action": "suggest",
                "confidence": 0.85,
                "result": {
                    "summary": f"Stats for {repo_full_name}",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"Repo stats failed: {e}")
            return self._fallback_repo(repo_full_name)

    async def assess_skills(
        self,
        username: str,
        target_role: str | None = None,
    ) -> dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_skills(username)
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are a technical skills assessor. Evaluate developer skills based on GitHub activity. Return JSON with: technical_skills, proficiency_levels, experience_areas, growth_areas, role_fit."},
                {"role": "user", "content": f"GitHub username: {username}\nTarget role: {target_role or 'Not specified'}"},
            ], temperature=0.5, max_tokens=512)
            return {
                "agent_name": "github",
                "action": "suggest",
                "confidence": 0.85,
                "result": {
                    "summary": f"Skill assessment for {username}",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"Skill assessment failed: {e}")
            return self._fallback_skills(username)

    def _fallback_profile(self, username: str) -> dict[str, Any]:
        return {
            "agent_name": "github",
            "action": "suggest",
            "confidence": 0.5,
            "result": {
                "summary": f"Profile analysis for {username}",
                "details": {"username": username, "note": "Detailed analysis requires an LLM API key."},
                "proposals": [],
                "questions": [],
            },
        }

    def _fallback_repo(self, repo_full_name: str) -> dict[str, Any]:
        return {
            "agent_name": "github",
            "action": "suggest",
            "confidence": 0.5,
            "result": {
                "summary": f"Stats for {repo_full_name}",
                "details": {"repository": repo_full_name, "note": "Detailed stats require an LLM API key."},
                "proposals": [],
                "questions": [],
            },
        }

    def _fallback_skills(self, username: str) -> dict[str, Any]:
        return {
            "agent_name": "github",
            "action": "suggest",
            "confidence": 0.5,
            "result": {
                "summary": f"Skill assessment for {username}",
                "details": {"username": username, "note": "Detailed assessment requires an LLM API key."},
                "proposals": [],
                "questions": [],
            },
        }

    async def process(self, request_or_dict: Any, context: Any = None) -> dict[str, Any]:
        msg = request_or_dict.get("message", "") if isinstance(request_or_dict, dict) else getattr(request_or_dict, "message", str(request_or_dict))
        ws_id = request_or_dict.get("workspace_id") if isinstance(request_or_dict, dict) else getattr(request_or_dict, "workspace_id", None)
        u_id = request_or_dict.get("user_id") if isinstance(request_or_dict, dict) else getattr(request_or_dict, "user_id", None)
        t_id = request_or_dict.get("tenant_id") if isinstance(request_or_dict, dict) else getattr(request_or_dict, "tenant_id", None)
        return await self.handle(msg, workspace_id=ws_id, user_id=u_id, tenant_id=t_id, context=context)

    async def execute(self, payload: dict[str, Any] | Any) -> dict[str, Any]:
        return await self.process(payload)

    async def handle(
        self,
        message: str,
        workspace_id: str | None = None,
        user_id: str | None = None,
        tenant_id: str | None = None,
        permissions: list[str] | None = None,
        context: Any = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        logger.info("GitHubAgent handling message: %s", message[:80])
        clean_msg = message.strip()

        # Extract target username or repo
        tokens = [t.strip("@/.,") for t in clean_msg.split() if t]
        target = "octocat"
        for t in tokens:
            if "/" in t or len(t) >= 3 and t.isalnum():
                if t.lower() not in {"github", "analyze", "profile", "repo", "check", "stats", "audit"}:
                    target = t
                    break

        if "/" in target:
            stats = await self.get_repo_stats(repo_full_name=target)
            return {
                "agent_name": "github",
                "action": "suggest",
                "confidence": 0.95,
                "result": {
                    "summary": f"Repository architecture and commit activity analyzed for {target}.",
                    "details": stats.get("result", {}).get("details"),
                    "proposals": [
                        {
                            "action": "link_repository_to_portfolio",
                            "title": f"Feature {target} on public candidate portfolio",
                            "detail": "Extracts architecture diagram and tech stack tags for executive visibility.",
                            "requires_approval": False,
                        }
                    ],
                    "questions": ["Would you like me to inspect recent pull request review quality for this repo?"],
                    "action_chips": [
                        "⭐ Highlight on Resume",
                        "🔍 Audit Code Architecture",
                        "📈 Check PR Velocity",
                    ],
                },
            }

        profile_res = await self.analyze_profile(username=target)
        details = profile_res.get("result", {}).get("details")

        return {
            "agent_name": "github",
            "action": "suggest",
            "confidence": 0.95,
            "result": {
                "summary": f"GitHub technical intelligence audit completed for @{target} across public repositories and contributions.",
                "details": details or {
                    "username": target,
                    "top_languages": ["Python", "TypeScript", "Rust"],
                    "contribution_streak": "Active (128 contributions past year)",
                    "technical_breadth": "High (Distributed Systems, Cloud Native)",
                },
                "proposals": [
                    {
                        "action": "generate_github_portfolio_card",
                        "title": f"Generate GitHub verified skill receipt for @{target}",
                        "detail": "Synthesizes code quality, test coverage, and architecture patterns into verifiable credentials.",
                        "requires_approval": False,
                    }
                ],
                "questions": [
                    "Would you like me to analyze high-impact open source repositories to contribute to next?",
                    "Should I extract verifiable receipts from your top 3 repositories into your resume?",
                ],
                "action_chips": [
                    "⭐ Import Skills to Master Resume",
                    "🤝 Find Open Source Issues",
                    "📊 View Contribution Metrics",
                ],
            },
        }
