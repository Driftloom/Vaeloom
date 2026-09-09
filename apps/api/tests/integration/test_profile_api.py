import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestProfileApi:
    async def test_get_profile_unauthenticated(self, client: AsyncClient):
        res = await client.get("/api/v1/profile")
        assert res.status_code == 401

    async def test_get_profile_authenticated(self, client: AsyncClient, auth_headers: dict):
        res = await client.get("/api/v1/profile", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["email"] == "int-user@test.com"

    async def test_update_profile(self, client: AsyncClient, auth_headers: dict):
        payload = {
            "display_name": "Updated Profile Tester",
            "headline": "Staff AI Engineer",
            "bio": "Building next-gen AI career tools",
            "location": "San Francisco, CA",
            "job_title": "Staff AI Engineer",
            "phone": "+1 555-0199",
            "social_links": {"github": "https://github.com/vaeloom-test", "linkedin": "https://linkedin.com/in/vaeloom-test"},
        }
        res = await client.put("/api/v1/profile", json=payload, headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["display_name"] == "Updated Profile Tester"
        assert data["headline"] == "Staff AI Engineer"
        assert data["bio"] == "Building next-gen AI career tools"
        assert data["location"] == "San Francisco, CA"
        assert data["social_links"]["github"] == "https://github.com/vaeloom-test"

    async def test_profile_completeness(self, client: AsyncClient, auth_headers: dict):
        res = await client.get("/api/v1/profile/completeness", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert "score" in data
        assert "suggestions" in data
        assert isinstance(data["score"], int)

    async def test_upload_avatar_invalid_type(self, client: AsyncClient, auth_headers: dict):
        files = {"file": ("test.txt", b"not an image", "text/plain")}
        res = await client.post("/api/v1/profile/avatar", files=files, headers=auth_headers)
        assert res.status_code == 400
        assert "File must be an image" in res.text

    async def test_skills_two_way_memory_loop(self, client: AsyncClient, auth_headers: dict):
        # 1. Create a workspace
        ws_res = await client.post("/api/v1/workspaces", json={"name": "Profile WS"}, headers=auth_headers)
        assert ws_res.status_code == 201
        ws_id = ws_res.json()["id"]

        # 2. Add skill
        add_res = await client.post(
            "/api/v1/profile/skills",
            json={"skill_name": "Python", "workspace_id": ws_id, "confidence": 0.95},
            headers=auth_headers,
        )
        assert add_res.status_code == 200
        skills = add_res.json()["skills"]
        assert any(s["name"] == "Python" for s in skills)

        # 3. Confirm another skill
        conf_res = await client.post(
            "/api/v1/profile/skills/confirm",
            json={"skill_name": "FastAPI", "workspace_id": ws_id},
            headers=auth_headers,
        )
        assert conf_res.status_code == 200
        skills = conf_res.json()["skills"]
        fastapi_skill = next((s for s in skills if s["name"] == "FastAPI"), None)
        assert fastapi_skill is not None
        assert fastapi_skill["verified"] is True
        assert fastapi_skill["confidence"] == 1.0

        # 4. Query profile with workspace_id to verify memory aggregation
        prof_res = await client.get(f"/api/v1/profile?workspace_id={ws_id}", headers=auth_headers)
        assert prof_res.status_code == 200
        prof_skills = prof_res.json()["skills"]
        assert len(prof_skills) >= 2

        # 5. Remove skill
        del_res = await client.delete(f"/api/v1/profile/skills/Python?workspace_id={ws_id}", headers=auth_headers)
        assert del_res.status_code == 200
        rem_skills = del_res.json()["skills"]
        assert not any(s["name"] == "Python" for s in rem_skills)
        assert any(s["name"] == "FastAPI" for s in rem_skills)

    async def test_update_job_preferences(self, client: AsyncClient, auth_headers: dict):
        ws_res = await client.post("/api/v1/workspaces", json={"name": "Pref WS"}, headers=auth_headers)
        assert ws_res.status_code == 201
        ws_id = ws_res.json()["id"]

        pref_payload = {
            "workspace_id": ws_id,
            "job_types": ["Full-time", "Contract"],
            "remote_preference": "Remote",
            "dealbreakers": ["No weekend on-call"],
            "preferred_industries": ["AI/ML", "FinTech"],
        }
        res = await client.put("/api/v1/profile/preferences", json=pref_payload, headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["job_preferences"] is not None
        assert "Full-time" in data["job_preferences"]["job_types"]
        assert data["job_preferences"]["remote_preference"] == "Remote"

    async def test_get_avatar_public(self, client: AsyncClient):
        # Unauthenticated request to /api/v1/profile/avatar/{id} should return 404, not 401
        res = await client.get("/api/v1/profile/avatar/00000000-0000-0000-0000-000000000000")
        assert res.status_code == 404

    async def test_auto_populate_from_resume(self, client: AsyncClient, auth_headers: dict, db_session):
        import uuid
        from api.models.schema import Resume

        ws_res = await client.post("/api/v1/workspaces", json={"name": "AutoPopulate WS"}, headers=auth_headers)
        assert ws_res.status_code == 201
        ws_id = ws_res.json()["id"]

        resume_content = {
            "headline": "Lead AI Architect",
            "summary": "Pioneering distributed agent systems and multi-modal architectures.",
            "location": "Seattle, WA",
            "skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "PyTorch"],
            "experience": [
                {
                    "company": "DeepMind Corp",
                    "role": "Staff Research Engineer",
                    "start": "2021",
                    "end": "Present",
                    "bullets": ["Engineered next-gen multi-agent orchestrator"],
                }
            ],
            "links": {"github": "https://github.com/ai-staff", "linkedin": "https://linkedin.com/in/ai-staff"},
        }
        res_obj = Resume(
            id=uuid.uuid4(),
            workspace_id=uuid.UUID(ws_id),
            variant_type="master",
            content=resume_content,
            version=1,
        )
        db_session.add(res_obj)
        await db_session.commit()

        pop_res = await client.post(
            "/api/v1/profile/auto-populate",
            json={"workspace_id": ws_id},
            headers=auth_headers,
        )
        assert pop_res.status_code == 200
        data = pop_res.json()
        assert data["headline"] == "Lead AI Architect"
        assert "distributed agent systems" in (data["bio"] or "")
        assert data["location"] == "Seattle, WA"
        assert any(s["name"] == "PyTorch" for s in data["skills"])
        assert any(c["company"] == "DeepMind Corp" for c in data["career_history"])

    async def test_public_profile(self, client: AsyncClient, auth_headers: dict):
        prof_res = await client.get("/api/v1/profile", headers=auth_headers)
        assert prof_res.status_code == 200
        user_id = prof_res.json()["id"]

        pub_res = await client.get(f"/api/v1/profile/public/{user_id}")
        assert pub_res.status_code == 200
        pub_data = pub_res.json()
        assert pub_data["id"] == user_id
        assert "display_name" in pub_data

        bad_res = await client.get("/api/v1/profile/public/00000000-0000-0000-0000-000000000000")
        assert bad_res.status_code == 404

    async def test_ats_readiness(self, client: AsyncClient, auth_headers: dict):
        ws_res = await client.post("/api/v1/workspaces", json={"name": "ATS WS"}, headers=auth_headers)
        assert ws_res.status_code == 201
        ws_id = ws_res.json()["id"]

        res = await client.get(f"/api/v1/profile/ats-readiness?workspace_id={ws_id}", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert "score" in data
        assert "status_label" in data
        assert "target_role" in data
        assert isinstance(data["matching_skills"], list)
        assert isinstance(data["missing_skills"], list)

    async def test_profile_recommendations(self, client: AsyncClient, auth_headers: dict):
        ws_res = await client.post("/api/v1/workspaces", json={"name": "Rec WS"}, headers=auth_headers)
        assert ws_res.status_code == 201
        ws_id = ws_res.json()["id"]

        res = await client.get(f"/api/v1/profile/recommendations?workspace_id={ws_id}", headers=auth_headers)
        assert res.status_code == 200
        recs = res.json()
        assert isinstance(recs, list)
        assert len(recs) >= 1
        assert "agent_name" in recs[0]
        assert "impact" in recs[0]

    async def test_career_crud_and_activity(self, client: AsyncClient, auth_headers: dict):
        ws_res = await client.post("/api/v1/workspaces", json={"name": "Career WS"}, headers=auth_headers)
        assert ws_res.status_code == 201
        ws_id = ws_res.json()["id"]

        # 1. Add career entry
        add_res = await client.post(
            "/api/v1/profile/career",
            json={
                "workspace_id": ws_id,
                "company": "Stripe",
                "role": "Staff Engineer",
                "start_date": "2021-01",
                "end_date": "Present",
                "achievements": ["Scaled payments infrastructure", "Reduced latency by 40%"],
            },
            headers=auth_headers,
        )
        assert add_res.status_code == 200
        data = add_res.json()
        assert any(c["company"] == "Stripe" for c in data["career_history"])

        # 2. Update career entry
        update_res = await client.put(
            "/api/v1/profile/career/Stripe",
            json={
                "workspace_id": ws_id,
                "role": "Principal Engineer",
                "achievements": ["Scaled payments infrastructure to 5M tps"],
            },
            headers=auth_headers,
        )
        assert update_res.status_code == 200
        up_data = update_res.json()
        stripe_entry = next(c for c in up_data["career_history"] if c["company"] == "Stripe")
        assert stripe_entry["role"] == "Principal Engineer"

        # 3. Get profile activity stream
        act_res = await client.get(f"/api/v1/profile/activity?workspace_id={ws_id}", headers=auth_headers)
        assert act_res.status_code == 200
        acts = act_res.json()
        assert isinstance(acts, list)
        assert len(acts) >= 1
        assert "timestamp" in acts[0]

        # 4. Delete career entry
        del_res = await client.delete(
            f"/api/v1/profile/career/Stripe?workspace_id={ws_id}",
            headers=auth_headers,
        )
        assert del_res.status_code == 200
        del_data = del_res.json()
        assert not any(c["company"] == "Stripe" for c in del_data["career_history"])


