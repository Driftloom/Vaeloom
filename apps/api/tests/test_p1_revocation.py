"""AUTH-REV-01 adversarial battery: shared revocation across workers.

Proves: worker A revokes -> worker B rejects (separate PROCESSES sharing only
the DB file); revoke-all watermarks; Redis-outage degradation to DB truth;
concurrent validation; no process-local state decides.
"""
import multiprocessing as mp
import time
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

pytestmark = pytest.mark.asyncio


def _child_validate(db_file: str, jti: str, user_id: str, iat: float,
                    raw: str, q):
    import asyncio
    import sys

    sys.path.insert(0, "apps/api/src")

    async def go():
        from api.services import auth_service as mod

        eng = create_async_engine(f"sqlite+aiosqlite:///{db_file}", poolclass=NullPool)
        mk = async_sessionmaker(eng, expire_on_commit=False)
        async with mk() as s:
            revoked, reason = await mod.auth_service.is_token_revoked_async(
                jti=jti, user_id=user_id, iat=iat, raw_token=raw, db=s)
        await eng.dispose()
        return revoked, reason

    q.put(asyncio.run(go()))


def _check_in_fresh_process(db_file, jti, user_id, iat, raw):
    ctx = mp.get_context("spawn")
    q = ctx.Queue()
    p = ctx.Process(target=_child_validate, args=(db_file, jti, user_id, iat, raw, q))
    p.start()
    p.join(120)
    assert p.exitcode == 0, f"child exitcode={p.exitcode}"
    return q.get()


class TestRevocationCrossWorker:
    async def test_worker_a_revoke_worker_b_rejects(
        self, client: AsyncClient, db_path: str
    ):
        from api.services import auth_service as mod

        r = await client.post("/api/v1/auth/signup",
                              json={"email": "rev-a@test.com", "password": "Test1234!"})
        assert r.status_code == 201, r.text
        token = r.json()["access_token"]
        import jwt as _jwt

        payload = _jwt.decode(token, options={"verify_signature": False})
        jti, uid, iat = payload["jti"], payload["sub"], float(payload["iat"])

        # sanity: valid before revoke (own process, DB truth)
        eng = create_async_engine(f"sqlite+aiosqlite:///{db_path}", poolclass=NullPool)
        mk = async_sessionmaker(eng, expire_on_commit=False)
        async with mk() as s:
            revoked, _ = await mod.auth_service.is_token_revoked_async(
                jti=jti, user_id=uid, iat=iat, raw_token=token, db=s)
        assert revoked is False

        # logout via HTTP (writes shared DB status + Redis best-effort)
        lo = await client.post("/api/v1/auth/logout",
                               headers={"Authorization": f"Bearer {token}"})
        assert lo.status_code == 204, lo.text

        # same-process HTTP now rejects
        me = await client.get("/api/v1/auth/me",
                              headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 401, me.text

        # fresh PROCESS (no shared memory possible) rejects via DB truth
        revoked_b, reason_b = _check_in_fresh_process(db_path, jti, uid, iat, token)
        assert revoked_b is True, f"cross-worker revocation invisible: {reason_b}"
        await eng.dispose()

    async def test_revoke_all_watermark(self, client: AsyncClient, db_session):
        from api.services import auth_service as mod

        r = await client.post("/api/v1/auth/signup",
                              json={"email": "rev-b@test.com", "password": "Test1234!"})
        token = r.json()["access_token"]
        import jwt as _jwt

        payload = _jwt.decode(token, options={"verify_signature": False})
        uid, iat = payload["sub"], float(payload["iat"])

        time.sleep(1.1)  # strict-inequality cutoff needs a later timestamp
        await mod.auth_service.revoke_all_user_tokens(uid, db=db_session)
        await db_session.commit()

        revoked, reason = await mod.auth_service.is_token_revoked_async(
            jti=payload["jti"], user_id=uid, iat=iat, raw_token=token, db=db_session)
        assert revoked is True and reason == "cutoff", reason

        # fresh login afterwards is accepted (iat > cutoff)
        r2 = await client.post("/api/v1/auth/login",
                               json={"email": "rev-b@test.com", "password": "Test1234!"})
        assert r2.status_code == 200, r2.text
        p2 = _jwt.decode(r2.json()["access_token"], options={"verify_signature": False})
        revoked2, _ = await mod.auth_service.is_token_revoked_async(
            jti=p2["jti"], user_id=uid, iat=float(p2["iat"]),
            raw_token=r2.json()["access_token"], db=db_session)
        assert revoked2 is False

    async def test_redis_outage_degrades_to_db(self, client: AsyncClient, db_session, monkeypatch):
        from api.services import auth_service as mod

        monkeypatch.setenv("REDIS_URL", "redis://localhost:9/0")
        monkeypatch.setattr(mod, "_redis_checked", False)
        monkeypatch.setattr(mod, "_redis_client", None)
        try:
            r = await client.post("/api/v1/auth/signup",
                                  json={"email": "rev-c@test.com", "password": "Test1234!"})
            token = r.json()["access_token"]
            import jwt as _jwt

            payload = _jwt.decode(token, options={"verify_signature": False})
            # revoke path must not crash without Redis; DB truth still applies
            mod.auth_service.revoke_token(payload["jti"])
            await client.post("/api/v1/auth/logout",
                              headers={"Authorization": f"Bearer {token}"})
            me = await client.get("/api/v1/auth/me",
                                  headers={"Authorization": f"Bearer {token}"})
            assert me.status_code == 401, me.text
            revoked, _ = await mod.auth_service.is_token_revoked_async(
                jti=payload["jti"], user_id=payload["sub"], iat=float(payload["iat"]),
                raw_token=token, db=db_session)
            assert revoked is True
        finally:
            monkeypatch.delenv("REDIS_URL", raising=False)
            monkeypatch.setattr(mod, "_redis_checked", False)
            monkeypatch.setattr(mod, "_redis_client", None)

    async def test_concurrent_validation_consistent(self, client: AsyncClient, db_session):
        import asyncio

        from api.services import auth_service as mod

        r = await client.post("/api/v1/auth/signup",
                              json={"email": "rev-d@test.com", "password": "Test1234!"})
        token = r.json()["access_token"]
        import jwt as _jwt

        payload = _jwt.decode(token, options={"verify_signature": False})
        await client.post("/api/v1/auth/logout",
                          headers={"Authorization": f"Bearer {token}"})

        async def check(_):
            eng = create_async_engine("sqlite+aiosqlite:///:memory:")
            await eng.dispose()
            return await mod.auth_service.is_token_revoked_async(
                jti=payload["jti"], user_id=payload["sub"], iat=float(payload["iat"]),
                raw_token=token, db=db_session)

        results = await asyncio.gather(*[check(i) for i in range(16)])
        assert all(r[0] is True for r in results), results

    async def test_no_process_local_state(self):
        from api.services import auth_service as mod

        assert not hasattr(mod.AuthService, "_revoked_tokens"), "process-local denylist remains"
        assert not hasattr(mod.AuthService, "_revoked_users_before"), "process-local cutoffs remain"
        assert str(uuid.uuid4())  # silence linters about unused import
