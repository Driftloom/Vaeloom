import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user, get_tenant_id
from ..orchestrator.router import UserRequest, handle
from ..schemas.agent import (
    AgentCreate,
    AgentExecute,
    AgentResponse,
    AgentUpdate,
    ExecutionResponse,
    ScheduleRequest,
    ScheduleResponse,
)
from ..services.agent_service import agent_service

router = APIRouter()


# ── Canonical catalog + skills/tools mapping ───────────────────────
@router.get("/catalog", response_model=dict)
async def get_agent_catalog(
    current_user: dict = Depends(get_current_user),
):
    """Return enriched canonical agent catalog: agents + skills + tools used.

    Data is derived from orchestrator registry and tool definitions - not just DB rows.
    Works even when no agents have been persisted yet.
    """
    from ..orchestrator.router import AGENT_REGISTRY, MVP_CANONICAL_AGENTS
    from ..tools.definitions import ALL_TOOLS

    catalog = []
    for name, cls in AGENT_REGISTRY.items():
        inst = None
        try:
            inst = cls()
        except Exception:
            inst = None

        # Extract mission, tools, memory scopes, autonomy
        mission = getattr(inst or cls, "mission", "") or getattr(cls, "__doc__", "") or ""
        tools_declared = getattr(inst or cls, "tools", []) or []
        # tools may be Tool pydantic or plain; normalize to names
        tool_names: list[str] = []
        for t in tools_declared:
            if isinstance(t, dict):
                tool_names.append(t.get("name", str(t)))
            elif hasattr(t, "name"):
                tool_names.append(t.name)
            else:
                tool_names.append(str(t))

        # Resolve full tool definitions
        tool_defs = []
        for tn in tool_names:
            td = ALL_TOOLS.get(tn)
            if td:
                tool_defs.append({
                    "name": td.name,
                    "description": td.description,
                    "required_scope": td.required_scope,
                    "category": td.category,
                    "input_schema": td.input_schema,
                })
            else:
                tool_defs.append({"name": tn, "description": "", "required_scope": "unknown", "category": "unknown"})

        memory_scopes = getattr(inst or cls, "memory_scopes", None)
        if memory_scopes is not None and hasattr(memory_scopes, "model_dump"):
            memory_scopes_dict = memory_scopes.model_dump()
        elif memory_scopes is not None:
            memory_scopes_dict = {"read_types": getattr(memory_scopes, "read_types", []), "write_types": getattr(memory_scopes, "write_types", [])}
        else:
            memory_scopes_dict = {"read_types": [], "write_types": []}

        default_autonomy = getattr(inst or cls, "default_autonomy", "suggest")
        is_canonical = name in MVP_CANONICAL_AGENTS

        # Derive skills from category + tools (human readable)
        # Skills are capability labels shown in UI
        skills = []
        # Core skill from mission / name
        if name == "organization":
            skills = ["Document Organization", "Deduplication", "Folder Routing"]
        elif name == "memory":
            skills = ["Entity Extraction", "Knowledge Graph", "Memory Consolidation"]
        elif name == "resume":
            skills = ["Resume Generation", "Template Filling", "Variant Tailoring"]
        elif name == "ats":
            skills = ["ATS Scoring", "Keyword Gap", "Resume Audit"]
        elif name == "job_search":
            skills = ["Job Discovery", "Ranking", "Opportunity Match"]
        elif name == "application":
            skills = ["Application Draft", "Cover Letter", "Submission (Approval-Gated)"]
        elif name == "gmail":
            skills = ["Inbox Watch", "Deadline Extraction", "Draft-Only Email"]
        elif name == "scheduler":
            skills = ["Calendar Merge", "Conflict Check", "Reminder Dispatch"]
        else:
            # Enterprise extras: derive from tools
            skills = [td["name"].replace("_", " ").title() for td in tool_defs[:3]] or [name.title()]

        catalog.append({
            "name": name,
            "mission": mission.strip() if isinstance(mission, str) else str(mission),
            "tools": tool_defs,
            "tool_names": tool_names,
            "memory_scopes": memory_scopes_dict,
            "default_autonomy": default_autonomy,
            "is_canonical": is_canonical,
            "skills": skills,
            "category": "canonical" if is_canonical else "enterprise",
        })

    # Sort canonical first
    catalog.sort(key=lambda x: (0 if x["is_canonical"] else 1, x["name"]))

    return {
        "agents": catalog,
        "total": len(catalog),
        "canonical_count": sum(1 for c in catalog if c["is_canonical"]),
        "tool_definitions": {k: {"description": v.description, "category": v.category, "required_scope": v.required_scope} for k, v in ALL_TOOLS.items()},
    }


@router.post("", response_model=AgentResponse, status_code=201)
async def create_agent(
    dto: AgentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    user_id = current_user.get("sub") or current_user.get("user_id") if current_user else None
    agent = await agent_service.register_agent(dto=dto, tenant_id=tenant_id, user_id=user_id, db=db)
    return AgentResponse.model_validate(agent)


class ChatMessage(BaseModel):
    workspaceId: str
    message: str
    agentName: str | None = None


@router.post("/chat", status_code=200)
async def chat(
    dto: ChatMessage,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """
    High-level chat endpoint: auto-classifies intent, routes to the right agent,
    runs the agentic loop, and returns the result. If dto.agentName is provided
    (enterprise explicit routing), honors it with high confidence.
    """
    req = UserRequest(
        request_id=str(uuid.uuid4()),
        message=dto.message,
        workspace_id=dto.workspaceId,
        preferred_agent=dto.agentName.strip().lower() if dto.agentName else None,
    )
    result = await handle(req)
    return result


@router.post("/chat/stream", status_code=200)
async def chat_stream(
    dto: ChatMessage,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """
    Streaming orchestrator chat — phase-by-phase SSE.

    Events:
      intent → plan → act → tool_start/tool_result → observe → reflect → token* → approval_required? → done
    Uses the full 5-phase loop (not the simple execute path) with QA gate.
    """
    from ..orchestrator.loop import AgentRequest, run_agent_loop_stream
    from ..orchestrator.router import AGENT_REGISTRY, classify_intent
    from ..agents.qa_agent.handler import QAAgent
    from ..config import settings
    from ..infrastructure.agent_eval import detect_adversarial_prompt
    from ..infrastructure.agent_observability import kill_switch

    req_id = str(uuid.uuid4())
    preferred = dto.agentName.strip().lower() if dto.agentName else None

    async def event_gen():
        try:
            # ── Supervisor multi-agent fast-path (before single-agent classification) ──
            # If message looks like a multi-intent complex goal and no explicit agent forced,
            # delegate to the supervisor streaming DAG instead of single-agent loop.
            if not preferred:
                try:
                    from ..orchestrator.supervisor import is_multi_agent_request as _is_multi, run_supervisor_stream
                    if _is_multi(dto.message):
                        yield f"event: supervisor_start\ndata: {json.dumps({'message': 'Complex multi-step goal detected — delegating to specialist team'})}\n\n"
                        async for sup_evt in run_supervisor_stream(dto.message, dto.workspaceId, req_id):
                            yield f"event: {sup_evt.get('event','data')}\ndata: {json.dumps(sup_evt.get('data', {}))}\n\n"
                            if sup_evt.get("event") == "done":
                                # QA gate for supervisor output
                                final = sup_evt.get("data", {})
                                summary = final.get("result", {}).get("summary", "") if isinstance(final.get("result"), dict) else str(final.get("result", ""))
                                qa = QAAgent()
                                agent_output = {"agent_name": "supervisor", "action": "suggest", "confidence": 0.87, "result": {"summary": summary, "details": None, "proposals": [], "questions": []}}
                                for attempt in range(3):
                                    qa_res = await qa.validate(agent_output)
                                    yield f"event: qa\ndata: {json.dumps({'attempt': attempt+1, 'decision': qa_res.decision, 'issues': qa_res.issues})}\n\n"
                                    if qa_res.decision == "approved":
                                        break
                                return
                        return
                except Exception as e:
                    # Fall through to single-agent on supervisor error
                    yield f"event: supervisor_error\ndata: {json.dumps({'message': str(e), 'fallback': 'single-agent'})}\n\n"

            # ── 1. Intent classification ──────────────────────────
            if preferred and preferred in AGENT_REGISTRY:
                agent_name, confidence = preferred, 0.98
            else:
                agent_name, confidence = await classify_intent(dto.message)
            yield f"event: intent\ndata: {json.dumps({'agent': agent_name, 'confidence': confidence, 'request_id': req_id})}\n\n"

            # ── MVP scope lock ──────────────────────────────────
            if settings.mvp_scope_enforced and agent_name not in __import__('api.orchestrator.router', fromlist=['MVP_CANONICAL_AGENTS']).MVP_CANONICAL_AGENTS:
                yield f"event: out_of_scope\ndata: {json.dumps({'agent': agent_name, 'message': f'{agent_name} is outside MVP scope'})}\n\n"
                yield f"event: done\ndata: {json.dumps({'status': 'out_of_scope'})}\n\n"
                return

            # ── 2. Low confidence ────────────────────────────────
            if confidence < 0.7:
                yield f"event: ask_clarification\ndata: {json.dumps({'confidence': confidence, 'questions': ['Could you clarify what you need help with?']})}\n\n"
                yield f"event: done\ndata: {json.dumps({'status': 'needs_clarification'})}\n\n"
                return

            # ── 3. Guards ───────────────────────────────────────
            if not kill_switch.is_enabled(agent_name):
                _msg = f"Agent '{agent_name}' is disabled"
                yield f"event: error\ndata: {json.dumps({'message': _msg})}\n\n"
                yield f"event: done\ndata: {{}}\n\n"
                return
            adversarial = detect_adversarial_prompt(dto.message)
            if adversarial and any(d.get("severity") == "critical" for d in adversarial):
                yield f"event: error\ndata: {json.dumps({'message': 'Input flagged by security filter'})}\n\n"
                yield f"event: done\ndata: {{}}\n\n"
                return

            # ── 4. Instantiate & stream loop ─────────────────────
            agent_cls = AGENT_REGISTRY.get(agent_name)
            if not agent_cls:
                yield f"event: error\ndata: {json.dumps({'message': f'No agent for {agent_name}'})}\n\n"
                yield f"event: done\ndata: {{}}\n\n"
                return
            agent = agent_cls()
            agent_req = AgentRequest(agent=agent, request_id=req_id, message=dto.message, workspace_id=dto.workspaceId, agent_name=agent_name)

            final_summary = ""
            async for evt in run_agent_loop_stream(agent_req):
                ev_type = evt.get("event", "data")
                ev_data = evt.get("data", {})
                # Capture final summary for QA gate
                if ev_type == "done":
                    final_summary = ev_data.get("result", "") if isinstance(ev_data, dict) else str(ev_data)
                    # ── QA Gate (streamed) ──────────────────────
                    qa = QAAgent()
                    agent_output = {"agent_name": agent_name, "action": "suggest", "confidence": confidence, "result": {"summary": final_summary, "details": None, "proposals": [], "questions": []}}
                    for attempt in range(3):
                        qa_res = await qa.validate(agent_output)
                        yield f"event: qa\ndata: {json.dumps({'attempt': attempt+1, 'decision': qa_res.decision, 'issues': qa_res.issues})}\n\n"
                        if qa_res.decision == "approved":
                            break
                    # Surface pending approvals
                    try:
                        from ..orchestrator.loop import fetch_pending_approvals
                        pending = await fetch_pending_approvals(dto.workspaceId)
                        for p in pending:
                            yield f"event: approval_required\ndata: {json.dumps(p)}\n\n"
                    except Exception:
                        pass
                    yield f"event: {ev_type}\ndata: {json.dumps(ev_data)}\n\n"
                    return
                # Forward with SSE framing — split token events individually already handled in loop_stream
                yield f"event: {ev_type}\ndata: {json.dumps(ev_data)}\n\n"

            # Fallback done if loop didn't emit it
            yield f"event: done\ndata: {json.dumps({'status': 'completed', 'result': final_summary})}\n\n"

        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'message': str(e)})}\n\n"
            yield f"event: done\ndata: {{}}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("", response_model=dict)
async def list_agents(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    category: str | None = Query(None),
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    agents, total = await agent_service.list_agents(
        db=db, page=page, page_size=page_size, tenant_id=tenant_id,
        category=category, search=search,
    )
    return {
        "agents": [AgentResponse.model_validate(a) for a in agents],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    agent = await agent_service.get_agent(db, agent_id, tenant_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return AgentResponse.model_validate(agent)


@router.post("/{agent_id}/execute")
async def execute_agent(
    agent_id: uuid.UUID,
    dto: AgentExecute,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    user_id = current_user.get("sub") or current_user.get("user_id") if current_user else None

    if dto.stream:
        async def event_stream():
            try:
                yield "event: start\ndata: {}\n\n"
                async for chunk in agent_service.execute_agent_stream(db, agent_id, dto, tenant_id, user_id):
                    yield f"data: {json.dumps(chunk)}\n\n"
                yield "event: done\ndata: {}\n\n"
            except ValueError as e:
                yield f"event: error\ndata: {json.dumps({'message': str(e)})}\n\n"
            except Exception as e:
                yield f"event: error\ndata: {json.dumps({'message': str(e)})}\n\n"

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    try:
        execution = await agent_service.execute_agent(db, agent_id, dto, tenant_id, user_id)
        return ExecutionResponse.model_validate(execution)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{agent_id}/executions", response_model=dict)
async def list_executions(
    agent_id: uuid.UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    executions, total = await agent_service.list_executions(
        db=db, agent_id=agent_id, page=page, page_size=page_size,
        tenant_id=tenant_id, status=status,
    )
    return {
        "executions": [ExecutionResponse.model_validate(e) for e in executions],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: uuid.UUID,
    dto: AgentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    agent = await agent_service.update_agent(agent_id, dto, db)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return AgentResponse.model_validate(agent)


@router.delete("/{agent_id}", status_code=204)
async def deactivate_agent(
    agent_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    deleted = await agent_service.deactivate_agent(agent_id, db)
    if not deleted:
        raise HTTPException(status_code=404, detail="Agent not found")


@router.post("/{agent_id}/run", response_model=ExecutionResponse)
async def run_agent(
    agent_id: uuid.UUID,
    dto: AgentExecute,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub") or current_user.get("user_id") if current_user else None
    try:
        execution = await agent_service.execute_agent(db, agent_id, dto, tenant_id, user_id)
        return ExecutionResponse.model_validate(execution)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{agent_id}/schedule", response_model=ScheduleResponse, status_code=201)
async def schedule_agent(
    agent_id: uuid.UUID,
    dto: ScheduleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    schedule = await agent_service.schedule_agent(
        agent_id=agent_id, cron=dto.cron, input=dto.input, enabled=dto.enabled, db=db,
    )
    await db.commit()
    # Shadow Temporal schedule (fail-open)
    try:
        from ..temporal.schedules import create_or_update_schedule
        import asyncio as _aio

        ws = None
        try:
            # Try to derive workspace from agent row
            from sqlalchemy import select as _sel
            from ..models.schema import Agent as _Agent

            r = await db.execute(_sel(_Agent.workspace_id).where(_Agent.id == agent_id))
            row = r.first()
            if row and row[0]:
                ws = str(row[0])
        except Exception:
            ws = None
        if not ws and isinstance(dto.input, dict):
            ws = dto.input.get("workspace_id") or dto.input.get("workspaceId")  # type: ignore[union-attr]
        _aio.create_task(create_or_update_schedule(str(schedule.id), dto.cron, ws, payload={"agent_id": str(agent_id), "input": dto.input or {}}))
    except Exception:
        pass
    return ScheduleResponse.model_validate(schedule)
