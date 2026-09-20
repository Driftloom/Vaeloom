import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestMarketplace:
    """Test enterprise marketplace listings, search, install, and uninstall."""

    async def test_seed_and_list_marketplace_plugins(
        self, client: AsyncClient, auth_headers: dict
    ):
        # 1. Seed curated enterprise listings
        seed_res = await client.post(
            "/api/v1/marketplace/seed",
            headers=auth_headers,
        )
        assert seed_res.status_code == 200, seed_res.text
        assert seed_res.json()["count"] >= 9

        # 2. List all plugins
        list_res = await client.get(
            "/api/v1/marketplace/listings",
            headers=auth_headers,
        )
        assert list_res.status_code == 200
        data = list_res.json()
        assert data["total"] >= 9
        assert len(data["items"]) >= 9

        # 3. Filter by category
        cat_res = await client.get(
            "/api/v1/marketplace/listings?category=AI",
            headers=auth_headers,
        )
        assert cat_res.status_code == 200
        cat_data = cat_res.json()
        assert all(item["category"] == "AI" for item in cat_data["items"])

        # 4. Search by keyword
        search_res = await client.get(
            "/api/v1/marketplace/listings?search=slack",
            headers=auth_headers,
        )
        assert search_res.status_code == 200
        search_data = search_res.json()
        assert len(search_data["items"]) >= 1
        assert "slack" in search_data["items"][0]["name"].lower()

    async def test_install_and_uninstall_plugin(
        self, client: AsyncClient, auth_headers: dict
    ):
        # Create a workspace first
        ws_res = await client.post(
            "/api/v1/workspaces",
            json={"name": "Marketplace WS"},
            headers=auth_headers,
        )
        assert ws_res.status_code == 201
        ws_id = ws_res.json()["id"]

        # Ensure plugins seeded
        await client.post("/api/v1/marketplace/seed", headers=auth_headers)

        # Get first listing
        list_res = await client.get(
            "/api/v1/marketplace/listings",
            headers=auth_headers,
        )
        listing = list_res.json()["items"][0]
        listing_id = listing["id"]

        # Install plugin
        install_res = await client.post(
            f"/api/v1/marketplace/listings/{listing_id}/install",
            json={"workspace_id": ws_id, "config": {"api_key": "test-key"}},
            headers=auth_headers,
        )
        assert install_res.status_code == 201
        install_data = install_res.json()
        assert install_data["workspace_id"] == ws_id
        assert install_data["listing_id"] == listing_id
        assert install_data["is_active"] is True

        # Check installed list
        installed_res = await client.get(
            f"/api/v1/marketplace/installed?workspace_id={ws_id}",
            headers=auth_headers,
        )
        assert installed_res.status_code == 200
        installed_items = installed_res.json()["items"]
        assert len(installed_items) >= 1
        assert any(item["listing_id"] == listing_id for item in installed_items)

        # Uninstall plugin
        del_res = await client.delete(
            f"/api/v1/marketplace/listings/{listing_id}/uninstall?workspace_id={ws_id}",
            headers=auth_headers,
        )
        assert del_res.status_code == 200
        assert del_res.json()["uninstalled"] is True

        # Check installed list is now empty or inactive
        post_del_res = await client.get(
            f"/api/v1/marketplace/installed?workspace_id={ws_id}",
            headers=auth_headers,
        )
        assert post_del_res.status_code == 200
        active_items = [i for i in post_del_res.json()["items"] if i["is_active"]]
        assert not any(item["listing_id"] == listing_id for item in active_items)

    async def test_rate_marketplace_listing(
        self, client: AsyncClient, auth_headers: dict
    ):
        await client.post("/api/v1/marketplace/seed", headers=auth_headers)

        list_res = await client.get("/api/v1/marketplace/listings", headers=auth_headers)
        listing_id = list_res.json()["items"][0]["id"]

        # Submit rating 5.0
        rate_res = await client.post(
            f"/api/v1/marketplace/listings/{listing_id}/rate",
            json={"rating": 5.0, "review": "Exceptional integration and reliability."},
            headers=auth_headers,
        )
        assert rate_res.status_code == 200
        rate_data = rate_res.json()
        assert rate_data["rating"] == 5.0
        assert rate_data["average_rating"] == 5.0

        # Invalid rating > 5.0 -> 400
        bad_rate = await client.post(
            f"/api/v1/marketplace/listings/{listing_id}/rate",
            json={"rating": 5.5},
            headers=auth_headers,
        )
        assert bad_rate.status_code == 422 or bad_rate.status_code == 400

    async def test_execute_installed_plugin(
        self, client: AsyncClient, auth_headers: dict
    ):
        # Create workspace
        ws_res = await client.post(
            "/api/v1/workspaces",
            json={"name": "Plugin Execution WS"},
            headers=auth_headers,
        )
        assert ws_res.status_code == 201
        ws_id = ws_res.json()["id"]

        await client.post("/api/v1/marketplace/seed", headers=auth_headers)
        list_res = await client.get("/api/v1/marketplace/listings", headers=auth_headers)
        listing_id = list_res.json()["items"][0]["id"]

        # Install with sensitive secret in config
        inst_res = await client.post(
            f"/api/v1/marketplace/listings/{listing_id}/install",
            json={"workspace_id": ws_id, "config": {"api_key": "top-secret-token-xyz"}},
            headers=auth_headers,
        )
        assert inst_res.status_code == 201
        install_id = inst_res.json()["install_id"]

        # Execute plugin action
        exec_res = await client.post(
            f"/api/v1/marketplace/installed/{install_id}/execute",
            json={
                "workspace_id": ws_id,
                "action": "sync_notifications",
                "params": {"channel": "#general"},
            },
            headers=auth_headers,
        )
        assert exec_res.status_code == 200
        exec_data = exec_res.json()
        assert exec_data["status"] == "success"
        assert exec_data["action"] == "sync_notifications"
        assert exec_data["result"]["configured"] is True

