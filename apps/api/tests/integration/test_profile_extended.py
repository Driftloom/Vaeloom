import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestProfileExtendedApi:
    async def _create_workspace(self, client: AsyncClient, auth_headers: dict) -> str:
        ws_res = await client.post("/api/v1/workspaces", json={"name": "Test Ext WS"}, headers=auth_headers)
        assert ws_res.status_code == 201
        return ws_res.json()["id"]

    async def test_extended_profile_fields_present(self, client: AsyncClient, auth_headers: dict):
        res = await client.get("/api/v1/profile", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert "education" in data
        assert "projects" in data
        assert "application_vault" in data
        assert "agent_directives" in data
        assert "company_blacklist" in data
        assert "screening_questions" in data

    async def test_education_crud(self, client: AsyncClient, auth_headers: dict):
        ws_id = await self._create_workspace(client, auth_headers)

        # Add Education
        edu_payload = {
            "workspace_id": ws_id,
            "institution": "Stanford University",
            "degree": "Master of Science",
            "field_of_study": "Computer Science",
            "start_year": 2020,
            "graduation_year": 2022,
            "gpa": "3.95",
            "show_gpa_on_resume": True,
            "honors": ["Dean's Award", "Fellowship"],
        }
        res = await client.post("/api/v1/profile/education", json=edu_payload, headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        edu_entries = data.get("education", [])
        assert len(edu_entries) >= 1
        created = next((e for e in edu_entries if e["institution"] == "Stanford University"), None)
        assert created is not None
        assert created["degree"] == "Master of Science"
        assert created["field_of_study"] == "Computer Science"

        # Update Education
        edu_id = created["id"]
        update_payload = {
            "workspace_id": ws_id,
            "degree": "M.S. in Artificial Intelligence",
        }
        res_up = await client.put(f"/api/v1/profile/education/{edu_id}", json=update_payload, headers=auth_headers)
        assert res_up.status_code == 200
        data_up = res_up.json()
        updated = next((e for e in data_up["education"] if e["id"] == edu_id), None)
        assert updated is not None
        assert updated["degree"] == "M.S. in Artificial Intelligence"

        # Delete Education
        res_del = await client.delete(f"/api/v1/profile/education/{edu_id}?workspace_id={ws_id}", headers=auth_headers)
        assert res_del.status_code == 200
        data_del = res_del.json()
        remaining = [e for e in data_del["education"] if e["id"] == edu_id]
        assert len(remaining) == 0

    async def test_projects_crud(self, client: AsyncClient, auth_headers: dict):
        ws_id = await self._create_workspace(client, auth_headers)

        proj_payload = {
            "workspace_id": ws_id,
            "title": "Autonomous Agent Mesh",
            "tagline": "Distributed multi-agent consensus network",
            "description": "Engineered peer-to-peer agent communication protocol with cryptographic audit logs.",
            "technologies": ["Python", "FastAPI", "Next.js", "Redis"],
            "metrics_summary": "Handled 10k messages/sec with <5ms latency",
            "live_url": "https://vaeloom.app",
            "github_url": "https://github.com/vaeloom/agent-mesh",
            "featured": True,
        }
        res = await client.post("/api/v1/profile/projects", json=proj_payload, headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        projs = data.get("projects", [])
        assert len(projs) >= 1
        created = next((p for p in projs if p["title"] == "Autonomous Agent Mesh"), None)
        assert created is not None
        assert created["metrics_summary"] == "Handled 10k messages/sec with <5ms latency"

        # Update Project
        proj_id = created["id"]
        res_up = await client.put(
            f"/api/v1/profile/projects/{proj_id}",
            json={"workspace_id": ws_id, "tagline": "Next-gen distributed multi-agent consensus network"},
            headers=auth_headers,
        )
        assert res_up.status_code == 200
        data_up = res_up.json()
        updated = next((p for p in data_up["projects"] if p["id"] == proj_id), None)
        assert updated is not None
        assert updated["tagline"] == "Next-gen distributed multi-agent consensus network"

        # Delete Project
        res_del = await client.delete(f"/api/v1/profile/projects/{proj_id}?workspace_id={ws_id}", headers=auth_headers)
        assert res_del.status_code == 200

    async def test_application_vault_update(self, client: AsyncClient, auth_headers: dict):
        ws_id = await self._create_workspace(client, auth_headers)

        vault_payload = {
            "workspace_id": ws_id,
            "demographics_policy": "autofill",
            "gender": "Non-Binary",
            "ethnicity": "Asian",
            "veteran_status": "I am not a protected veteran",
            "disability_status": "No, I do not have a disability",
            "authorized_countries": ["US", "CA", "IN"],
            "visa_status": "Permanent Resident / Green Card",
            "requires_sponsorship": False,
            "security_clearance": "Secret",
        }
        res = await client.put("/api/v1/profile/vault", json=vault_payload, headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        vault = data.get("application_vault")
        assert vault is not None
        assert vault["demographics_policy"] == "autofill"
        assert vault["visa_status"] == "Permanent Resident / Green Card"
        assert "IN" in vault["authorized_countries"]
        assert vault["security_clearance"] == "Secret"

    async def test_agent_directives_and_multi_currency(self, client: AsyncClient, auth_headers: dict):
        ws_id = await self._create_workspace(client, auth_headers)

        directives_payload = {
            "workspace_id": ws_id,
            "autonomy_mode": "semi_autonomous",
            "min_match_threshold": 85,
            "daily_application_quota": 15,
            "min_base_salary": 160000,
            "target_base_salary": 200000,
            "target_total_comp": 260000,
            "currency": "USD",
            "notice_period": "1 month",
            "relocation_preference": "Willing to relocate with assistance",
            "travel_percentage": "Up to 10%",
            "cover_letter_policy": "when_required",
        }
        res = await client.put("/api/v1/profile/directives", json=directives_payload, headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        dirs = data.get("agent_directives")
        assert dirs is not None
        assert dirs["autonomy_mode"] == "semi_autonomous"
        assert dirs["min_match_threshold"] == 85
        assert dirs["min_base_salary"] == 160000
        assert dirs["currency"] == "USD"

        # Also test with INR
        directives_inr = {
            "workspace_id": ws_id,
            "currency": "INR",
            "min_base_salary": 3500000,
            "target_base_salary": 5000000,
        }
        res_inr = await client.put("/api/v1/profile/directives", json=directives_inr, headers=auth_headers)
        assert res_inr.status_code == 200
        assert res_inr.json()["agent_directives"]["currency"] == "INR"

    async def test_company_blacklist_and_auto_protect(self, client: AsyncClient, auth_headers: dict):
        ws_id = await self._create_workspace(client, auth_headers)

        # Add a current career role
        career_payload = {
            "workspace_id": ws_id,
            "company": "CurrentEmployerCorp",
            "role": "Principal Architect",
            "start_date": "2023-01",
            "end_date": "Present",
            "achievements": ["Spearheaded multi-tenant cloud migration"],
            "is_current": True,
        }
        await client.post("/api/v1/profile/career", json=career_payload, headers=auth_headers)

        # Add explicit competitor to blacklist
        bl_payload = {
            "workspace_id": ws_id,
            "company_name": "RivalCorp",
            "domain": "rivalcorp.com",
            "reason": "Direct Competitor",
        }
        res_bl = await client.post("/api/v1/profile/blacklist", json=bl_payload, headers=auth_headers)
        assert res_bl.status_code == 200
        bl_data = res_bl.json()["company_blacklist"]

        # Check that RivalCorp is in blacklist
        rival = next((b for b in bl_data if b["company_name"] == "RivalCorp"), None)
        assert rival is not None
        assert rival["reason"] == "Direct Competitor"

        # Check that CurrentEmployerCorp is automatically inferred & protected!
        current_emp = next((b for b in bl_data if b["company_name"] == "CurrentEmployerCorp"), None)
        assert current_emp is not None
        assert current_emp["auto_inferred"] is True
