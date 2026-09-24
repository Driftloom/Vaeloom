"""
Tests for ConversationAgent, Card Registry, and Scaffolding Interaction.
Verifies radical honesty: 0 mocks in routing logic, authentic cognitive scaffolding,
and robust boundary condition handling ('9876', 'hlo', '@scheduler hlo').
"""
import pytest
from api.agents.conversation_agent.handler import ConversationAgent
from api.orchestrator.card_registry import card_registry, get_agent_card
from api.orchestrator.loop import _dispatch_agent, AgentRequest
from api.agents.scheduler_agent.handler import SchedulerAgent


@pytest.mark.asyncio
async def test_conversation_agent_greetings():
    agent = ConversationAgent()
    for greeting in ["hlo", "hi", "hello", "hey", "good morning", "how are you"]:
        res = await agent.execute(greeting)
        assert res["agent_name"] == "conversation"
        assert res["confidence"] == 0.95
        assert "Hello!" in res["result"]["summary"] or "Vaeloom" in res["result"]["summary"]
        assert len(res["result"]["action_chips"]) >= 3


@pytest.mark.asyncio
async def test_conversation_agent_farewell_and_thanks():
    agent = ConversationAgent()
    r_bye = await agent.execute("bye")
    assert "Goodbye" in r_bye["result"]["summary"]

    r_thanks = await agent.execute("thank you")
    assert "welcome" in r_bye["result"]["summary"].lower() or "welcome" in r_thanks["result"]["summary"].lower()


@pytest.mark.asyncio
async def test_conversation_agent_boundary_digits_9876():
    agent = ConversationAgent()
    # Test raw '9876' as well as with RAG context appended by orchestrator loop
    res = await agent.execute("9876")
    assert res["agent_name"] == "conversation"
    assert "keyboard test" in res["result"]["summary"]
    assert "action_chips" in res["result"]
    assert len(res["result"]["action_chips"]) > 0

    rag_wrapped = "9876\n\n[Context from knowledge graph & documents:\n<untrusted-data>\n</untrusted-data>]"
    res_rag = await agent.execute(rag_wrapped)
    assert res_rag["agent_name"] == "conversation"
    assert "keyboard test" in res_rag["result"]["summary"]


@pytest.mark.asyncio
async def test_conversation_card_registration():
    card = get_agent_card("conversation")
    assert card is not None
    assert card.name == "conversation"
    assert card.version == "1.0.0"
    assert "Executive career advisor" in card.description
    assert "web_search" in card.tools
    assert "action_chips" in card.output_schema.get("properties", {})
    assert any("psychological safety" in g.lower() for g in card.safety_guidelines)


@pytest.mark.asyncio
async def test_scheduler_greeting_dispatch():
    sched_agent = SchedulerAgent()
    req = AgentRequest(agent=sched_agent, request_id="req-test-1", message="@scheduler hlo", workspace_id="ws-test", agent_name="scheduler")
    res = await _dispatch_agent("SchedulerAgent", sched_agent, "@scheduler hlo\n\n[Context from knowledge graph...]", req)
    assert res["agent_name"] == "scheduler"
    assert "Scheduler Agent" in res["result"]["summary"]
    assert "action_chips" in res["result"]
    assert len(res["result"]["action_chips"]) > 0


@pytest.mark.asyncio
async def test_distress_query_routing_and_containment():
    from api.orchestrator.router import classify_intent
    # Verify emotional distress queries bypass keyword trap (e.g. 'applications')
    agent_name, conf = await classify_intent("I feel overwhelmed and stressed about job applications")
    assert agent_name == "conversation"
    assert conf >= 0.90

    # Verify burn out query routes to conversation
    agent_name2, conf2 = await classify_intent("I am completely burnt out and exhausted from interviewing")
    assert agent_name2 == "conversation"
    assert conf2 >= 0.90

