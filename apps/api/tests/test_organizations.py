import uuid
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestOrganizations:
    """Test enterprise organization hierarchy, membership, and cycle detection."""

    async def test_create_and_get_organization_tree(
        self, client: AsyncClient, auth_headers: dict
    ):
        # 1. Create root organization
        root_res = await client.post(
            "/api/v1/organizations",
            json={
                "name": "Acme Global",
                "type": "organization",
            },
            headers=auth_headers,
        )
        assert root_res.status_code == 201, root_res.text
        root_data = root_res.json()
        root_id = root_data["id"]
        assert root_data["name"] == "Acme Global"
        assert root_data["type"] == "organization"

        # 2. Create child department
        dept_res = await client.post(
            "/api/v1/organizations",
            json={
                "name": "Engineering",
                "type": "department",
                "parent_id": root_id,
            },
            headers=auth_headers,
        )
        assert dept_res.status_code == 201
        dept_id = dept_res.json()["id"]

        # 3. Create sub-team under department
        team_res = await client.post(
            "/api/v1/organizations",
            json={
                "name": "Core Platform",
                "type": "team",
                "parent_id": dept_id,
            },
            headers=auth_headers,
        )
        assert team_res.status_code == 201
        team_id = team_res.json()["id"]

        # 4. Fetch tree and assert hierarchical nesting
        tree_res = await client.get(
            "/api/v1/organizations/tree",
            headers=auth_headers,
        )
        assert tree_res.status_code == 200
        tree = tree_res.json()["items"]
        assert len(tree) >= 1

        root_in_tree = next((node for node in tree if node["id"] == root_id), None)
        assert root_in_tree is not None
        assert len(root_in_tree["children"]) >= 1

        dept_in_tree = next(
            (c for c in root_in_tree["children"] if c["id"] == dept_id), None
        )
        assert dept_in_tree is not None
        assert len(dept_in_tree["children"]) >= 1
        assert dept_in_tree["children"][0]["id"] == team_id

    async def test_prevent_cycle_in_organization_tree(
        self, client: AsyncClient, auth_headers: dict
    ):
        # Create Node A
        res_a = await client.post(
            "/api/v1/organizations",
            json={"name": "Org A", "type": "organization"},
            headers=auth_headers,
        )
        id_a = res_a.json()["id"]

        # Create Node B child of A
        res_b = await client.post(
            "/api/v1/organizations",
            json={"name": "Dept B", "type": "department", "parent_id": id_a},
            headers=auth_headers,
        )
        id_b = res_b.json()["id"]

        # Attempt to make Node A child of Node B -> Cycle error 400
        cycle_res = await client.patch(
            f"/api/v1/organizations/{id_a}",
            json={"parent_id": id_b},
            headers=auth_headers,
        )
        assert cycle_res.status_code == 400
        error_msg = cycle_res.json().get("error", {}).get("message", "")
        assert "cycle" in error_msg.lower()

        # Attempt to make Node A child of itself -> Cycle error 400
        self_cycle_res = await client.patch(
            f"/api/v1/organizations/{id_a}",
            json={"parent_id": id_a},
            headers=auth_headers,
        )
        assert self_cycle_res.status_code == 400

    async def test_organization_membership_lifecycle(
        self, client: AsyncClient, auth_headers: dict
    ):
        # Create organization
        org_res = await client.post(
            "/api/v1/organizations",
            json={"name": "Design Studio", "type": "department"},
            headers=auth_headers,
        )
        org_id = org_res.json()["id"]

        # Sign up a member user
        user_res = await client.post(
            "/api/v1/auth/signup",
            json={"email": "designer@vaeloom.test", "password": "TestAuth1234!"},
        )
        assert user_res.status_code == 201
        member_uid = user_res.json()["user"]["id"]

        add_res = await client.post(
            f"/api/v1/organizations/{org_id}/members",
            json={"user_id": member_uid, "role": "lead"},
            headers=auth_headers,
        )
        assert add_res.status_code == 201
        assert add_res.json()["role"] == "lead"
        assert add_res.json()["user_id"] == member_uid

        # List members
        members_res = await client.get(
            f"/api/v1/organizations/{org_id}/members",
            headers=auth_headers,
        )
        assert members_res.status_code == 200
        members = members_res.json()["items"]
        assert len(members) == 1
        assert members[0]["user_id"] == member_uid

        # Remove member
        del_res = await client.delete(
            f"/api/v1/organizations/{org_id}/members/{member_uid}",
            headers=auth_headers,
        )
        assert del_res.status_code == 200
        assert del_res.json()["ok"] is True

        # Verify empty members list
        empty_res = await client.get(
            f"/api/v1/organizations/{org_id}/members",
            headers=auth_headers,
        )
        assert len(empty_res.json()["items"]) == 0

    async def test_delete_organization(
        self, client: AsyncClient, auth_headers: dict
    ):
        org_res = await client.post(
            "/api/v1/organizations",
            json={"name": "Temporary Team", "type": "team"},
            headers=auth_headers,
        )
        org_id = org_res.json()["id"]

        del_res = await client.delete(
            f"/api/v1/organizations/{org_id}",
            headers=auth_headers,
        )
        assert del_res.status_code == 200
        assert del_res.json()["ok"] is True

    async def test_organization_invitations_and_domain_whitelist(
        self, client: AsyncClient, auth_headers: dict
    ):
        # 1. Create org with allowed domains
        org_res = await client.post(
            "/api/v1/organizations",
            json={
                "name": "Enterprise Security Unit",
                "type": "organization",
                "allowed_domains": ["acme.corp", "enterprise.org"],
                "default_role": "member",
            },
            headers=auth_headers,
        )
        assert org_res.status_code == 201
        org_id = org_res.json()["id"]

        # 2. Try inviting email with disallowed domain -> 400
        bad_invite_res = await client.post(
            f"/api/v1/organizations/{org_id}/invitations",
            json={"email": "intruder@hacker.io", "role": "admin"},
            headers=auth_headers,
        )
        assert bad_invite_res.status_code == 400
        assert "domain" in bad_invite_res.json().get("error", {}).get("message", "").lower()

        # 3. Invite valid email with allowed domain -> 201
        good_invite_res = await client.post(
            f"/api/v1/organizations/{org_id}/invitations",
            json={"email": "alice@acme.corp", "role": "lead"},
            headers=auth_headers,
        )
        assert good_invite_res.status_code == 201
        invite_data = good_invite_res.json()
        assert invite_data["email"] == "alice@acme.corp"
        assert invite_data["role"] == "lead"
        assert invite_data["status"] == "pending"
        raw_token = invite_data["token"]
        invitation_id = invite_data["id"]

        # 4. List invitations
        list_res = await client.get(
            f"/api/v1/organizations/{org_id}/invitations",
            headers=auth_headers,
        )
        assert list_res.status_code == 200
        items = list_res.json()["items"]
        assert len(items) >= 1
        assert any(i["id"] == invitation_id for i in items)

        # 5. Sign up a new user and accept the invitation
        new_user_res = await client.post(
            "/api/v1/auth/signup",
            json={"email": "alice@acme.corp", "password": "AliceSecretPass123!"},
        )
        assert new_user_res.status_code == 201
        alice_token = new_user_res.json()["access_token"]
        alice_headers = {"Authorization": f"Bearer {alice_token}"}

        accept_res = await client.post(
            f"/api/v1/organizations/invitations/{raw_token}/accept",
            headers=alice_headers,
        )
        assert accept_res.status_code == 200
        assert accept_res.json()["status"] == "accepted"
        assert accept_res.json()["role"] == "lead"

        # 6. Verify Alice is now in the members list
        members_res = await client.get(
            f"/api/v1/organizations/{org_id}/members",
            headers=auth_headers,
        )
        assert members_res.status_code == 200
        m_items = members_res.json()["items"]
        assert any(m["email"] == "alice@acme.corp" and m["role"] == "lead" for m in m_items)

        # 7. Create another invitation and revoke it
        inv2_res = await client.post(
            f"/api/v1/organizations/{org_id}/invitations",
            json={"email": "bob@enterprise.org", "role": "member"},
            headers=auth_headers,
        )
        assert inv2_res.status_code == 201
        inv2_id = inv2_res.json()["id"]

        revoke_res = await client.delete(
            f"/api/v1/organizations/invitations/{inv2_id}",
            headers=auth_headers,
        )
        assert revoke_res.status_code == 200
        assert revoke_res.json()["ok"] is True

    async def test_department_rbac_permissions(
        self, client: AsyncClient, auth_headers: dict, db_session
    ):
        from api.services.organization_service import OrganizationService
        import uuid

        # Create Org Unit
        res = await client.post(
            "/api/v1/organizations",
            json={"name": "Finance Dept", "type": "department"},
            headers=auth_headers,
        )
        org_id = uuid.UUID(res.json()["id"])

        # Sign up a viewer
        viewer_res = await client.post(
            "/api/v1/auth/signup",
            json={"email": "viewer@finance.test", "password": "ViewerPass123!"},
        )
        viewer_id = uuid.UUID(viewer_res.json()["user"]["id"])

        # Add viewer with 'viewer' role
        await client.post(
            f"/api/v1/organizations/{org_id}/members",
            json={"user_id": str(viewer_id), "role": "viewer"},
            headers=auth_headers,
        )

        # Verify check_org_permission
        assert await OrganizationService.check_org_permission(db_session, org_id, viewer_id, "viewer") is True
        assert await OrganizationService.check_org_permission(db_session, org_id, viewer_id, "admin") is False

