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

        # List members.
        # The creator is enrolled as `owner` at creation time, so the org is
        # administrable from the moment it exists. A member-less org would make
        # every subsequent mutation by its own creator a 403.
        members_res = await client.get(
            f"/api/v1/organizations/{org_id}/members",
            headers=auth_headers,
        )
        assert members_res.status_code == 200
        members = members_res.json()["items"]
        assert len(members) == 2
        by_user = {m["user_id"]: m for m in members}
        assert by_user[member_uid]["role"] == "lead"
        owners = [m for m in members if m["role"] == "owner"]
        assert len(owners) == 1
        creator_uid = owners[0]["user_id"]
        assert creator_uid != member_uid

        # Remove the added member
        del_res = await client.delete(
            f"/api/v1/organizations/{org_id}/members/{member_uid}",
            headers=auth_headers,
        )
        assert del_res.status_code == 200
        assert del_res.json()["ok"] is True

        # The creator/owner must remain: the org cannot be left ownerless.
        after_res = await client.get(
            f"/api/v1/organizations/{org_id}/members",
            headers=auth_headers,
        )
        remaining = after_res.json()["items"]
        assert len(remaining) == 1
        assert remaining[0]["user_id"] == creator_uid
        assert remaining[0]["role"] == "owner"

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


    async def test_role_matrix_denies_unauthorized_mutations(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Negative control: a low-privilege member must be refused, not silently ignored.

        Before the role dependency existed every mutation depended only on
        `get_current_user`, so a viewer could add members, invite users, patch the
        org, and delete it. Each case below asserts the exact 403.
        """
        org_res = await client.post(
            "/api/v1/organizations",
            json={"name": "Guarded Dept", "type": "department"},
            headers=auth_headers,
        )
        assert org_res.status_code == 201
        org_id = org_res.json()["id"]

        low = await client.post(
            "/api/v1/auth/signup",
            json={"email": "lowpriv@guarded.test", "password": "LowPriv1234!"},
        )
        assert low.status_code == 201
        low_headers = {"Authorization": f"Bearer {low.json()['access_token']}"}
        low_id = low.json()["user"]["id"]

        # Enroll the low-privilege user as `member` (below the `admin` threshold).
        add = await client.post(
            f"/api/v1/organizations/{org_id}/members",
            json={"user_id": low_id, "role": "member"},
            headers=auth_headers,
        )
        assert add.status_code == 201

        # Every mutation below must be refused with an exact 403.
        denied = {
            "patch_org": await client.patch(
                f"/api/v1/organizations/{org_id}",
                json={"name": "Renamed By Member"},
                headers=low_headers,
            ),
            "add_member": await client.post(
                f"/api/v1/organizations/{org_id}/members",
                json={"user_id": str(uuid.uuid4()), "role": "viewer"},
                headers=low_headers,
            ),
            "remove_member": await client.delete(
                f"/api/v1/organizations/{org_id}/members/{low_id}",
                headers=low_headers,
            ),
            "create_invitation": await client.post(
                f"/api/v1/organizations/{org_id}/invitations",
                json={"email": "victim@guarded.test", "role": "member"},
                headers=low_headers,
            ),
            "list_invitations": await client.get(
                f"/api/v1/organizations/{org_id}/invitations",
                headers=low_headers,
            ),
            "delete_org": await client.delete(
                f"/api/v1/organizations/{org_id}",
                headers=low_headers,
            ),
        }
        for name, response in denied.items():
            assert response.status_code == 403, f"{name} returned {response.status_code}"

        # A member may still read the member list (viewer threshold).
        allowed = await client.get(
            f"/api/v1/organizations/{org_id}/members",
            headers=low_headers,
        )
        assert allowed.status_code == 200

    async def test_admin_cannot_grant_owner(self, client: AsyncClient, auth_headers: dict):
        """Negative control: `admin` must not be able to mint an `owner`.

        The org creator holds `owner`, so it can grant owner. A separately
        enrolled `admin` must be refused.
        """
        org_res = await client.post(
            "/api/v1/organizations",
            json={"name": "Escalation Dept", "type": "department"},
            headers=auth_headers,
        )
        org_id = org_res.json()["id"]

        admin_user = await client.post(
            "/api/v1/auth/signup",
            json={"email": "deptadmin@guarded.test", "password": "DeptAdmin1234!"},
        )
        admin_id = admin_user.json()["user"]["id"]
        admin_headers = {"Authorization": f"Bearer {admin_user.json()['access_token']}"}

        enrolled = await client.post(
            f"/api/v1/organizations/{org_id}/members",
            json={"user_id": admin_id, "role": "admin"},
            headers=auth_headers,
        )
        assert enrolled.status_code == 201

        target = await client.post(
            "/api/v1/auth/signup",
            json={"email": "escalation-target@guarded.test", "password": "Target1234!!"},
        )
        target_id = target.json()["user"]["id"]

        # admin -> owner must be refused
        escalate = await client.post(
            f"/api/v1/organizations/{org_id}/members",
            json={"user_id": target_id, "role": "owner"},
            headers=admin_headers,
        )
        assert escalate.status_code == 403

        # admin -> admin is allowed (equal rank)
        peer = await client.post(
            f"/api/v1/organizations/{org_id}/members",
            json={"user_id": target_id, "role": "admin"},
            headers=admin_headers,
        )
        assert peer.status_code == 201

    async def test_unknown_role_is_rejected(self, client: AsyncClient, auth_headers: dict):
        """Roles are a closed set; an unrecognised role must fail validation."""
        org_res = await client.post(
            "/api/v1/organizations",
            json={"name": "Validation Dept", "type": "department"},
            headers=auth_headers,
        )
        org_id = org_res.json()["id"]

        bad = await client.post(
            f"/api/v1/organizations/{org_id}/members",
            json={"user_id": str(uuid.uuid4()), "role": "superuser"},
            headers=auth_headers,
        )
        assert bad.status_code == 422

        bad_invite = await client.post(
            f"/api/v1/organizations/{org_id}/invitations",
            json={"email": "x@guarded.test", "role": "root"},
            headers=auth_headers,
        )
        assert bad_invite.status_code == 422

    async def test_invitation_is_bound_to_invited_email(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Negative control: a token must not be redeemable by a different account."""
        org_res = await client.post(
            "/api/v1/organizations",
            json={"name": "Bound Invite Dept", "type": "department"},
            headers=auth_headers,
        )
        org_id = org_res.json()["id"]

        invite = await client.post(
            f"/api/v1/organizations/{org_id}/invitations",
            json={"email": "intended@bound.test", "role": "member"},
            headers=auth_headers,
        )
        assert invite.status_code == 201
        token = invite.json()["token"]

        # A different account holding the token must be refused with 403.
        attacker = await client.post(
            "/api/v1/auth/signup",
            json={"email": "attacker@bound.test", "password": "Attacker1234!"},
        )
        attacker_headers = {"Authorization": f"Bearer {attacker.json()['access_token']}"}
        wrong_account = await client.post(
            f"/api/v1/organizations/invitations/{token}/accept",
            headers=attacker_headers,
        )
        assert wrong_account.status_code == 403

        # The intended recipient succeeds.
        intended = await client.post(
            "/api/v1/auth/signup",
            json={"email": "intended@bound.test", "password": "Intended1234!"},
        )
        intended_headers = {"Authorization": f"Bearer {intended.json()['access_token']}"}
        ok = await client.post(
            f"/api/v1/organizations/invitations/{token}/accept",
            headers=intended_headers,
        )
        assert ok.status_code == 200

        # Replay of the same token must fail: single-use invariant.
        replay = await client.post(
            f"/api/v1/organizations/invitations/{token}/accept",
            headers=intended_headers,
        )
        assert replay.status_code == 400
