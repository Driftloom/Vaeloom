import pytest
from vaeloom_connectors import (
    GitHubConnector,
    SlackConnector,
    GoogleDriveConnector,
    MCPConnector,
)


@pytest.mark.asyncio
async def test_github_connector_health_and_action():
    conn = GitHubConnector("gh-1", {"token": "mock-token"})
    health = await conn.health_check()
    assert health.is_healthy is True
    assert health.service_name == "github"

    res = await conn.execute_action("create_issue", {"title": "Test Issue", "repo": "vaeloom/api"})
    assert res["issue_id"] == 42
    assert res["title"] == "Test Issue"


@pytest.mark.asyncio
async def test_slack_connector():
    conn = SlackConnector("slack-1", {"webhook_url": "mock-url"})
    health = await conn.health_check()
    assert health.is_healthy is True

    res = await conn.execute_action("send_message", {"channel": "#general", "text": "Hello"})
    assert res["sent"] is True


@pytest.mark.asyncio
async def test_google_drive_connector():
    conn = GoogleDriveConnector("gdrive-1", {})
    health = await conn.health_check()
    assert health.is_healthy is True

    files = await conn.execute_action("list_files", {})
    assert len(files["files"]) == 1
    assert files["files"][0]["name"] == "Resume.pdf"


@pytest.mark.asyncio
async def test_mcp_connector():
    conn = MCPConnector("mcp-1", {})
    health = await conn.health_check()
    assert health.is_healthy is True

    res = await conn.execute_action("browse_page", {"url": "https://example.com"})
    assert res["result"] == "success"
