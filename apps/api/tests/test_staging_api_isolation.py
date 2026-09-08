"""Live isolation + load + perf through the DEPLOYED staging API (port 18000).

Exercises the real production middleware stack (Auth -> Tenant -> CSRF ->
routes -> PostgreSQL vaeloom_staging) with real JWTs. SKIPS when the staging
API is unreachable. Evidence: docs/audits/muse-final-production-gate.md.
"""
import asyncio
import os
import statistics
import time
import uuid

import httpx
import pytest

STAGING_API = os.environ.get("STAGING_API_URL", "http://localhost:18000")


def _stats_ms(samples: list[float]) -> dict:
    s = sorted(samples)
    n = len(s)
    if n == 0:
        return {"n": 0}
    pct = lambda p: s[min(n - 1, int(p * n))]
    return {
        "n": n,
        "p50": round(pct(0.50), 1),
        "p95": round(pct(0.95), 1),
        "p99": round(pct(0.99), 1) if n >= 100 else None,
        "max": round(s[-1], 1),
        "mean": round(sum(s) / n, 1),
    }


async def _staging_client() -> httpx.AsyncClient | None:
    try:
        client = httpx.AsyncClient(base_url=STAGING_API, timeout=20.0)
        r = await client.get("/health")
        if r.status_code != 200:
            await client.aclose()
            return None
        # Production CSRF stack: fetch double-submit token once per client.
        # NOTE: staging sets Secure cookies (service_environment=staging) so a
        # plain-HTTP httpx jar will not return the cookie; send it explicitly
        # via the Cookie header (server behavior is correct and unchanged).
        csrf = await client.get("/csrf-token")
        token = csrf.json().get("csrf_token", "")
        cookie_val = client.cookies.get("csrf_token", "")
        client.headers.update({"X-CSRF-Token": token, "Cookie": f"csrf_token={cookie_val}"})
        return client
    except Exception:
        return None


async def _signup(client: httpx.AsyncClient, email: str) -> str:
    r = await client.post("/api/v1/auth/signup", json={"email": email, "password": "Staging1234!"})
    assert r.status_code == 201, f"signup failed: {r.status_code} {r.text[:200]}"
    return r.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
class TestStagingIsolation:
    async def test_cross_user_memory_invisible(self):
        client = await _staging_client()
        if client is None:
            pytest.skip("staging API unreachable")
        try:
            tag = uuid.uuid4().hex[:8]
            tok_a = await _signup(client, f"gate-a-{tag}@example.com")
            ws = await client.post("/api/v1/workspaces", json={"name": f"ws-a-{tag}"}, headers=_auth(tok_a))
            assert ws.status_code in (200, 201), ws.text[:200]
            ws_id = ws.json()["id"]
            secret = f"GATE-SECRET-{tag}-alpha"
            mem = await client.post("/api/v1/memories", json={
                "type": "profile", "title": f"mem-{tag}", "content": secret,
            }, headers={**_auth(tok_a), "X-Workspace-ID": ws_id})
            assert mem.status_code in (200, 201), mem.text[:300]

            tok_b = await _signup(client, f"gate-b-{tag}@example.com")
            listed = await client.get("/api/v1/memories", headers=_auth(tok_b))
            assert listed.status_code == 200
            assert secret not in listed.text, "cross-user memory leak via staging API"

            direct = await client.get(f"/api/v1/workspaces/{ws_id}", headers=_auth(tok_b))
            assert direct.status_code in (403, 404), f"cross-workspace read: {direct.status_code}"

            found = await client.post("/api/v1/search", json={"query": secret}, headers=_auth(tok_b))
            assert found.status_code in (200, 400)
            if found.status_code == 200:
                assert secret not in found.text, "cross-user retrieval leak via staging search"
        finally:
            await client.aclose()

    async def test_concurrent_50_users_zero_leaks_with_latency(self):
        client = await _staging_client()
        if client is None:
            pytest.skip("staging API unreachable")
        try:
            tag = uuid.uuid4().hex[:6]
            users: list[tuple[str, str, str]] = []  # (token, workspace_id, secret)
            for i in range(50):
                tok = await _signup(client, f"load-{tag}-{i}@example.com")
                ws = await client.post("/api/v1/workspaces", json={"name": f"load-ws-{tag}-{i}"},
                                       headers=_auth(tok))
                assert ws.status_code in (200, 201), ws.text[:200]
                wid = ws.json()["id"]
                secret = f"LOAD-SECRET-{tag}-{i}"
                mem = await client.post("/api/v1/memories", json={
                    "type": "profile", "title": f"load-{tag}-{i}", "content": secret,
                }, headers={**_auth(tok), "X-Workspace-ID": wid})
                assert mem.status_code in (200, 201), mem.text[:300]
                users.append((tok, wid, secret))

            lat: list[float] = []
            errors = 0
            leaks = 0

            async def _probe(u: tuple[str, str, str]) -> None:
                nonlocal errors, leaks
                tok, wid, secret = u
                t0 = time.monotonic()
                try:
                    listed = await client.get("/api/v1/memories", headers=_auth(tok))
                    lat.append((time.monotonic() - t0) * 1000)
                    assert listed.status_code == 200
                    body = listed.text
                    assert secret in body, "own memory missing under load"
                    for _, _, other in users:
                        if other != secret and other in body:
                            leaks += 1
                except AssertionError:
                    raise
                except Exception:
                    errors += 1

            # Deterministic shuffle: A->B->A adjacency to stress pool reuse.
            order = list(range(50))
            order = order[::2] + order[::-2]
            await asyncio.gather(*(_probe(users[i]) for i in order))
            assert errors == 0, f"{errors} request errors under 50-way concurrency"
            assert leaks == 0, f"{leaks} cross-user leaks under 50-way concurrency"
            stats = _stats_ms(lat)
            print(f"GATE staging 50-user isolation: {stats}")
            assert stats["n"] == 50

            # Search-plane probe (second 50 requests -> n=100 retrieval sample).
            lat2: list[float] = []
            errors2 = 0

            async def _search(u: tuple[str, str, str]) -> None:
                nonlocal errors2
                tok, wid, secret = u
                t0 = time.monotonic()
                try:
                    r = await client.post("/api/v1/search", json={"query": secret}, headers=_auth(tok))
                    lat2.append((time.monotonic() - t0) * 1000)
                    assert r.status_code in (200, 400)
                    if r.status_code == 200:
                        for _, _, other in users:
                            if other != secret and other in r.text:
                                raise AssertionError("cross-user search leak")
                except AssertionError:
                    raise
                except Exception:
                    errors2 += 1

            await asyncio.gather(*(_search(u) for u in users))
            assert errors2 == 0
            stats2 = _stats_ms(lat2)
            print(f"GATE staging 50-user search: {stats2}")
            assert stats2["n"] == 50
        finally:
            await client.aclose()

    async def test_api_latency_distribution_n100(self):
        client = await _staging_client()
        if client is None:
            pytest.skip("staging API unreachable")
        try:
            lat: list[float] = []
            errors = 0
            for _ in range(100):
                t0 = time.monotonic()
                try:
                    r = await client.get("/health")
                    lat.append((time.monotonic() - t0) * 1000)
                    assert r.status_code == 200
                except Exception:
                    errors += 1
            stats = _stats_ms(lat)
            print(f"GATE staging /health n=100: {stats} errors={errors}")
            assert errors == 0
            assert stats["n"] == 100 and stats["p99"] is not None
        finally:
            await client.aclose()
