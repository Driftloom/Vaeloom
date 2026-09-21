import pytest
from httpx import AsyncClient
from uuid import uuid4


class TestFolders:
    async def _auth_header(self, client: AsyncClient, email: str = "folder_user@example.com") -> dict:
        pwd = "SecurePassword123!"
        await client.post("/api/v1/auth/signup", json={"email": email, "password": pwd})
        login_res = await client.post("/api/v1/auth/login", json={"email": email, "password": pwd})
        token = login_res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    async def _create_workspace(self, client: AsyncClient, headers: dict, name: str = "Folder WS") -> str:
        res = await client.post("/api/v1/workspaces", json={"name": name}, headers=headers)
        return res.json()["id"]

    async def test_create_and_list_folders(self, client: AsyncClient):
        headers = await self._auth_header(client, "test_f1@example.com")
        ws_id = await self._create_workspace(client, headers)

        # 1. Create root folder
        create_res = await client.post(
            f"/api/v1/documents/folders?workspace_id={ws_id}",
            json={"name": "Documents", "parent_id": None},
            headers=headers,
        )
        assert create_res.status_code == 201
        root_folder = create_res.json()
        assert root_folder["name"] == "Documents"
        assert root_folder["parent_id"] is None

        # 2. Create child folder
        child_res = await client.post(
            f"/api/v1/documents/folders?workspace_id={ws_id}",
            json={"name": "Invoices", "parent_id": root_folder["id"]},
            headers=headers,
        )
        assert child_res.status_code == 201
        child_folder = child_res.json()
        assert child_folder["name"] == "Invoices"
        assert child_folder["parent_id"] == root_folder["id"]

        # 3. List folders
        list_res = await client.get(
            f"/api/v1/documents/folders?workspace_id={ws_id}",
            headers=headers,
        )
        assert list_res.status_code == 200
        folders = list_res.json()
        assert len(folders) == 2

        # 4. Folder tree
        tree_res = await client.get(
            f"/api/v1/documents/folders/tree?workspace_id={ws_id}",
            headers=headers,
        )
        assert tree_res.status_code == 200
        tree = tree_res.json()
        assert len(tree) == 1
        assert tree[0]["name"] == "Documents"
        assert len(tree[0]["children"]) == 1
        assert tree[0]["children"][0]["name"] == "Invoices"

    async def test_folder_cycle_prevention(self, client: AsyncClient):
        headers = await self._auth_header(client, "test_f2@example.com")
        ws_id = await self._create_workspace(client, headers)

        # Create parent
        f1 = (await client.post(
            f"/api/v1/documents/folders?workspace_id={ws_id}",
            json={"name": "Folder 1", "parent_id": None},
            headers=headers,
        )).json()

        # Create child
        f2 = (await client.post(
            f"/api/v1/documents/folders?workspace_id={ws_id}",
            json={"name": "Folder 2", "parent_id": f1["id"]},
            headers=headers,
        )).json()

        # Attempt to set f1's parent to f2 (cycle!)
        cycle_res = await client.patch(
            f"/api/v1/documents/folders/{f1['id']}?workspace_id={ws_id}",
            json={"parent_id": f2["id"]},
            headers=headers,
        )
        assert cycle_res.status_code == 400
        body = cycle_res.json()
        err_msg = body.get("detail") or body.get("error", {}).get("message") or ""
        assert "circular" in err_msg.lower()

    async def test_folder_delete(self, client: AsyncClient):
        headers = await self._auth_header(client, "test_f3@example.com")
        ws_id = await self._create_workspace(client, headers)

        f = (await client.post(
            f"/api/v1/documents/folders?workspace_id={ws_id}",
            json={"name": "To Delete", "parent_id": None},
            headers=headers,
        )).json()

        del_res = await client.delete(
            f"/api/v1/documents/folders/{f['id']}?workspace_id={ws_id}",
            headers=headers,
        )
        assert del_res.status_code == 204

        # Verify not in list
        list_res = await client.get(
            f"/api/v1/documents/folders?workspace_id={ws_id}",
            headers=headers,
        )
        assert len(list_res.json()) == 0
