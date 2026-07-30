import pytest

pytestmark = pytest.mark.asyncio


class TestDocumentAgent:
    async def _agent(self):
        from backend.agents.memory.document_agent import DocumentAgent
        return DocumentAgent()

    async def test_fallback(self):
        agent = await self._agent()
        result = await agent.fallback()

        assert result["agent_name"] == "document"
        assert result["action"] == "ask_clarification"
        assert result["confidence"] == 0.0
        assert "questions" in result["result"]

    async def test_summarize_document(self):
        agent = await self._agent()
        result = await agent.summarize_document(
            content="This is a long document about machine learning and artificial intelligence."
        )

        assert result["agent_name"] == "document"
        assert result["action"] == "summarize"
        assert result["confidence"] == 0.85

    async def test_summarize_document_custom_length(self):
        agent = await self._agent()
        result = await agent.summarize_document(
            content="Short doc",
            max_length=50,
        )

        assert result["action"] == "summarize"

    async def test_summarize_empty_content(self):
        agent = await self._agent()
        result = await agent.summarize_document(content="")

        assert result["action"] == "summarize"
        assert result["confidence"] == 0.85

    async def test_extract_from_document(self):
        agent = await self._agent()
        result = await agent.extract_from_document(
            content="John Doe has 5 years of Python experience.",
            extraction_goal="Extract the person's name and skills",
        )

        assert result["agent_name"] == "document"
        assert result["action"] == "extract"
        assert result["confidence"] == 0.85

    async def test_extract_with_complex_goal(self):
        agent = await self._agent()
        result = await agent.extract_from_document(
            content="Company ABC was founded in 2020. Revenue: $10M. CEO: Jane Smith.",
            extraction_goal="Extract company details, founding year, revenue, and leadership",
        )

        assert result["action"] == "extract"

    async def test_search_document(self):
        agent = await self._agent()
        result = await agent.search_document(
            content="Python is a programming language. JavaScript is used for web development.",
            query="programming languages",
        )

        assert result["agent_name"] == "document"
        assert result["action"] == "search"
        assert result["confidence"] == 0.85

    async def test_search_document_custom_k(self):
        agent = await self._agent()
        result = await agent.search_document(
            content="Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8\nLine 9\nLine 10",
            query="lines",
            top_k=3,
        )

        assert result["action"] == "search"

    async def test_search_empty_query(self):
        agent = await self._agent()
        result = await agent.search_document(
            content="Some content here",
            query="",
        )

        assert result["action"] == "search"

    async def test_long_document_content(self):
        agent = await self._agent()
        long_content = "word " * 10000
        result = await agent.summarize_document(content=long_content)

        assert result["action"] == "summarize"
