import logging
import uuid
from typing import Any, Dict, Optional

from sqlalchemy import text

from .state import LoopState, load_or_create_state, save_checkpoint
from .base import BaseAgent

logger = logging.getLogger(__name__)


# ── Approval Lookup ────────────────────────────────────────────────

async def lookup_approval(
    workspace_id: str,
    agent_name: str,
    action_type: str,
) -> Optional[Dict[str, Any]]:
    """Look up an approved approval decision for the given agent/action.

    Returns the approval record if found and APPROVED, None otherwise.
    This replaces the hardcoded has_approval=False in the agent loop.
    """
    import json
    from ..database import async_session_factory

    try:
        async with async_session_factory() as db:
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc)

            # Expire any stale approvals
            await db.execute(
                text("""
                    UPDATE agent_approvals
                    SET status = 'EXPIRED', updated_at = :now
                    WHERE status = 'PENDING' AND expires_at IS NOT NULL AND expires_at < :now
                """),
                {"now": now},
            )
            await db.commit()

            # Look up approved approvals for this agent/action
            result = await db.execute(
                text("""
                    SELECT id, workspace_id, agent_name, action_type, payload, status
                    FROM agent_approvals
                    WHERE workspace_id = :workspace_id
                      AND agent_name = :agent_name
                      AND action_type = :action_type
                      AND status = 'APPROVED'
                    ORDER BY created_at DESC
                    LIMIT 1
                """),
                {
                    "workspace_id": workspace_id,
                    "agent_name": agent_name,
                    "action_type": action_type,
                },
            )
            row = result.fetchone()
            if row:
                # Handle payload: may be JSON string (SQLite) or dict (PostgreSQL)
                payload = row[4]
                if isinstance(payload, str):
                    try:
                        payload = json.loads(payload)
                    except (json.JSONDecodeError, TypeError):
                        payload = {}
                elif not isinstance(payload, dict):
                    payload = {}
                return {
                    "id": str(row[0]),
                    "workspace_id": str(row[1]),
                    "agent_name": row[2],
                    "action_type": row[3],
                    "payload": payload,
                    "status": row[5],
                }
            return None
    except Exception as exc:
        logger.warning(f"Approval lookup failed (non-blocking): {exc}")
        return None


class AgentRequest:
    def __init__(self, agent: BaseAgent, request_id: str, message: str, workspace_id: str, agent_name: str = ""):
        self.agent = agent
        self.id = request_id
        self.message = message
        self.workspace_id = workspace_id
        self.agent_name = agent_name or self._derive_agent_name()

    def _derive_agent_name(self) -> str:
        name = type(self.agent).__name__
        for suffix in ["AgentHandler", "Agent", "Handler"]:
            name = name.replace(suffix, "")
        return name.lower()


class AgentResponse:
    def __init__(self, status: str, final_result: Any):
        self.status = status
        self.final_result = final_result


class ReflectResult:
    def __init__(self, is_satisfied: bool, reason: str = ""):
        self.is_satisfied = is_satisfied
        self.reason = reason


# ── Plan ────────────────────────────────────────────────────────────

async def plan_phase(request: AgentRequest, state: LoopState) -> Dict[str, Any]:
    logger.info(f"PLAN: agent={request.agent_name}, request={request.id}")
    return {
        "agent_type": request.agent_name,
        "message": request.message,
        "workspace_id": request.workspace_id,
    }


# ── Act ─────────────────────────────────────────────────────────────

async def act_phase(plan: Dict[str, Any], request: AgentRequest) -> Dict[str, Any]:
    agent = request.agent
    message = plan.get("message", request.message)
    agent_type = type(agent).__name__

    logger.info(f"ACT: dispatching to {agent_type}")

    try:
        if agent_type == "OrganizationAgent":
            docs = [{"id": f"doc_{request.id}", "filename": message}]
            return await agent.execute(docs)

        if agent_type == "ResumeAgent":
            profile = {
                "name": "User",
                "email": "user@example.com",
                "education": [],
                "experience": [],
                "skills": [message] if message else [],
            }
            return await agent.execute(profile)

        if agent_type == "ATSAgent":
            parts = message.split(" vs ", 1) if " vs " in message.lower() else (message, "")
            return await agent.score(parts[0].strip(), parts[1].strip() if len(parts) > 1 else "")

        if agent_type == "JobSearchAgent":
            keywords = [w for w in message.split() if len(w) > 2]
            return await agent.search(keywords=keywords, user_skills=[], rejected_job_ids=[])

        if agent_type == "ApplicationAgent":
            job = {"id": f"job_{request.id}", "title": message, "company": "Target Company"}
            # CRITICAL FIX: Look up approval decision using request.agent_name
            approval = await lookup_approval(
                workspace_id=request.workspace_id,
                agent_name=request.agent_name,
                action_type="job_application",
            )
            has_approval = approval is not None and approval.get("status") == "APPROVED"
            if has_approval:
                logger.info(f"APPROVAL FOUND: {approval['id']} for job {job['id']}")
            else:
                logger.info("NO APPROVAL: Application will require user approval")
            return await agent.prepare(
                job=job, resume_text="", user_profile={"name": "User", "skills": []}, has_approval=has_approval
            )

        if agent_type in ("GmailAgent", "GmailAgentHandler"):
            emails = [{"id": f"email_{request.id}", "subject": message, "sender": "unknown", "body": message}]
            # Approval gate for email sends (draft-only without approval)
            approval = await lookup_approval(
                workspace_id=request.workspace_id,
                agent_name=request.agent_name,
                action_type="email_send",
            )
            has_approval = approval is not None and approval.get("status") == "APPROVED"
            return await agent.classify_emails(emails=emails, has_approval=has_approval)

        if agent_type in ("DriveAgent", "DriveAgentHandler"):
            # Approval gate for file operations
            approval = await lookup_approval(
                workspace_id=request.workspace_id,
                agent_name=request.agent_name,
                action_type="file_modify",
            )
            has_approval = approval is not None and approval.get("status") == "APPROVED"
            return await agent.process(request, has_approval=has_approval)

        if agent_type == "SchedulerAgent":
            # Approval gate for calendar writes
            approval = await lookup_approval(
                workspace_id=request.workspace_id,
                agent_name=request.agent_name,
                action_type="calendar_write",
            )
            has_approval = approval is not None and approval.get("status") == "APPROVED"
            return await agent.check_conflicts(events=[], has_approval=has_approval)

        if agent_type in ("MemoryAgent", "MemoryAgentHandler"):
            return await agent.execute(
                content=message,
                source_type="user_input",
                source_id=f"input_{request.id}",
                workspace_id=request.workspace_id,
            )

        return await agent.fallback()

    except Exception as exc:
        logger.exception(f"ACT phase failed: {exc}")
        return {
            "agent_name": request.agent_name,
            "action": "error",
            "confidence": 0.0,
            "result": {"summary": f"Execution error: {exc}", "details": None, "proposals": [], "questions": []},
        }


# ── Observe ─────────────────────────────────────────────────────────

async def observe_phase(act_result: Dict[str, Any]) -> Dict[str, Any]:
    result = act_result.get("result", {})
    logger.info(f"OBSERVE: action={act_result.get('action')}, summary={str(result.get('summary', ''))[:80]}")
    return {
        "observation": result.get("summary", ""),
        "action": act_result.get("action"),
        "confidence": act_result.get("confidence", 0.0),
        "payload": act_result,
    }


# ── Reflect ─────────────────────────────────────────────────────────

async def reflect_phase(request: AgentRequest, observe_result: Dict[str, Any], iteration: int) -> ReflectResult:
    action = observe_result.get("action", "")
    confidence = observe_result.get("confidence", 0.0)

    logger.info(f"REFLECT: action={action}, confidence={confidence}, iteration={iteration}")

    if action == "execute":
        return ReflectResult(True, "Executed successfully")

    if action == "suggest" and confidence >= 0.7:
        return ReflectResult(True, f"Good suggestion (confidence={confidence:.2f})")

    if action == "error":
        return ReflectResult(iteration >= 2, "Error - escalating" if iteration >= 2 else "Error - retrying")

    if action == "ask_clarification":
        return ReflectResult(
            iteration >= 2,
            "Clarification needed - escalating" if iteration >= 2 else "Need more info",
        )

    return ReflectResult(iteration >= 2, "Max iterations reached")


# ── Improve ─────────────────────────────────────────────────────────

async def improve_phase(state: LoopState, request: AgentRequest) -> AgentResponse:
    logger.info("IMPROVE: packaging final result")

    for i in range(2, -1, -1):
        key = f"observe_{i}"
        if key in state.phases:
            payload = state.phases[key].get("payload", {})
            summary = payload.get("result", {}).get("summary", "Task completed")
            return AgentResponse(status="success", final_result=summary)

    return AgentResponse(status="success", final_result="Task completed")


# ── Escalate ────────────────────────────────────────────────────────

async def escalate_to_user(state: LoopState) -> AgentResponse:
    logger.warning("ESCALATE: max iterations exceeded")
    return AgentResponse(status="escalated", final_result="max retries exceeded")


# ── Main Loop ───────────────────────────────────────────────────────

async def run_agent_loop(request: AgentRequest) -> AgentResponse:
    logger.info(f"START loop: request={request.id}, agent={request.agent_name}")
    state = await load_or_create_state(request.id)

    for iteration in range(3):
        logger.info(f"─── Iteration {iteration + 1}/3 ───")

        plan = await plan_phase(request, state)
        state.add_phase(f"plan_{iteration}", plan)
        await save_checkpoint(state)

        act_result = await act_phase(plan, request)
        state.add_phase(f"act_{iteration}", act_result)
        await save_checkpoint(state)

        observe_result = await observe_phase(act_result)
        state.add_phase(f"observe_{iteration}", observe_result)
        await save_checkpoint(state)

        reflect_result = await reflect_phase(request, observe_result, iteration)
        state.add_phase(f"reflect_{iteration}", {
            "is_satisfied": reflect_result.is_satisfied,
            "reason": reflect_result.reason,
        })
        await save_checkpoint(state)

        if reflect_result.is_satisfied:
            return await improve_phase(state, request)

    return await escalate_to_user(state)
