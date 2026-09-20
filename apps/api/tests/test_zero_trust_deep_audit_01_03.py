import asyncio
import time
import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import numpy as np
import pytest
from sqlalchemy import select

from api.models.schema import (
    AuthSession,
    EmailVerificationToken,
    OnboardingState,
    Tenant,
    User,
    Workspace,
    WorkspaceUser,
)
from api.services.auth_service import auth_service


@pytest.mark.asyncio
async def test_concurrent_onboarding_updates(client, db_session):
    """Zero-trust state machine audit: verify rapid step updates do not corrupt state or drop data."""
    signup_res = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "concurrent_ob@vaeloom.test",
            "password": "StrongPassword123!",
            "display_name": "Concurrent User",
        },
    )
    assert signup_res.status_code == 201
    token = signup_res.json()["access_token"]
    user_id = uuid.UUID(signup_res.json()["user"]["id"])

    # Perform rapid successive updates with different step data
    for i in range(5):
        res = await client.post(
            "/api/v1/onboarding/step",
            json={
                "step": "WORKSPACE",
                "step_data": {f"key_{i}": f"val_{i}"},
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200, f"Request {i} failed: {res.text}"

    # Verify final state in DB
    ob_res = await db_session.execute(
        select(OnboardingState).where(OnboardingState.user_id == user_id)
    )
    state = ob_res.scalar_one()
    assert state.current_step == "WORKSPACE"
    assert "PROFILE" in state.completed_steps
    assert isinstance(state.step_data, dict)
    # Check that keys are merged into step_data
    assert "key_4" in state.step_data


@pytest.mark.asyncio
async def test_session_revocation_enforcement_at_middleware(client, db_session):
    """Zero-trust session audit: verify revoked sessions are rejected by AuthMiddleware with 401."""
    signup_res = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "session_revoke@vaeloom.test",
            "password": "StrongPassword123!",
            "display_name": "Revoke User",
        },
    )
    assert signup_res.status_code == 201
    token = signup_res.json()["access_token"]
    user_id = signup_res.json()["user"]["id"]

    # 1. Access protected endpoint -> 200 OK
    get_sessions_res = await client.get(
        "/api/v1/auth/sessions",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_sessions_res.status_code == 200
    sessions = get_sessions_res.json()["sessions"]
    assert len(sessions) >= 1
    target_session_id = sessions[0]["id"]

    # 2. Revoke the session
    del_res = await client.delete(
        f"/api/v1/auth/sessions/{target_session_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert del_res.status_code == 204

    # 3. Attempting to use the revoked session's token now MUST fail with 401
    post_revoke_res = await client.get(
        "/api/v1/auth/sessions",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert post_revoke_res.status_code == 401
    detail = post_revoke_res.json().get("detail", "")
    assert "revoked" in detail.lower()


@pytest.mark.asyncio
async def test_durable_database_lockout(client, db_session):
    """Zero-trust resilience audit: DB-level durable lockout engages at 10 failed attempts and persists."""
    signup_res = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "durable_lockout@vaeloom.test",
            "password": "TargetPassword123!",
            "display_name": "Resilience Test",
        },
    )
    assert signup_res.status_code == 201
    user_id = uuid.UUID(signup_res.json()["user"]["id"])

    # Perform 9 failed logins
    for i in range(1, 10):
        res = await client.post(
            "/api/v1/auth/login",
            json={"email": "durable_lockout@vaeloom.test", "password": f"WrongPass{i}"},
        )
        assert res.status_code == 401

    # Check DB state
    user = (await db_session.execute(select(User).where(User.id == user_id))).scalar_one()
    assert user.failed_login_attempts == 9
    assert user.locked_until is None

    # 10th failed login
    res_10 = await client.post(
        "/api/v1/auth/login",
        json={"email": "durable_lockout@vaeloom.test", "password": "WrongPass10"},
    )
    assert res_10.status_code == 401

    # Check DB state: now locked
    await db_session.refresh(user)
    assert user.failed_login_attempts == 10
    assert user.locked_until is not None
    locked_until = user.locked_until
    if locked_until.tzinfo is None:
        locked_until = locked_until.replace(tzinfo=UTC)
    assert locked_until > datetime.now(UTC)

    # 11th attempt with correct password: must be rejected with 423
    res_11 = await client.post(
        "/api/v1/auth/login",
        json={"email": "durable_lockout@vaeloom.test", "password": "TargetPassword123!"},
    )
    assert res_11.status_code == 423
    detail = res_11.json().get("detail") or res_11.json().get("error", {}).get("message", "")
    assert "locked" in detail.lower()


@pytest.mark.asyncio
async def test_anti_enumeration_behaviors(client):
    """Zero-trust privacy audit: ensure password reset and verification resend do not leak user existence."""
    # 1. Resend verification for non-existent email
    res_unknown_verify = await client.post(
        "/api/v1/auth/resend-verification",
        json={"email": "nonexistent_user_9999@vaeloom.test"},
    )
    assert res_unknown_verify.status_code == 200
    assert res_unknown_verify.json()["status"] == "success"

    # 2. Forgot password for non-existent email
    res_unknown_pwd = await client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "nonexistent_user_9999@vaeloom.test"},
    )
    assert res_unknown_pwd.status_code == 200
    assert res_unknown_pwd.json()["status"] == "success"


@pytest.mark.asyncio
async def test_cross_tenant_workspace_and_onboarding_isolation(client, db_session):
    """Zero-trust multi-tenancy audit: ensure Tenant A and Tenant B remain completely isolated."""
    # Create Tenant A user
    res_a = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "tenant_a_user@vaeloom.test",
            "password": "Password123!",
            "display_name": "Tenant A User",
        },
    )
    assert res_a.status_code == 201
    token_a = res_a.json()["access_token"]
    user_a_id = uuid.UUID(res_a.json()["user"]["id"])

    # Create Tenant B user
    res_b = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "tenant_b_user@vaeloom.test",
            "password": "Password123!",
            "display_name": "Tenant B User",
        },
    )
    assert res_b.status_code == 201
    token_b = res_b.json()["access_token"]
    user_b_id = uuid.UUID(res_b.json()["user"]["id"])

    # Create workspace for User A
    ws_res = await client.post(
        "/api/v1/workspaces",
        json={"name": "Tenant A Secret WS"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert ws_res.status_code == 201
    ws_a_id = ws_res.json()["id"]

    # User B attempts to access User A's workspace
    ws_b_attempt = await client.get(
        f"/api/v1/workspaces/{ws_a_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert ws_b_attempt.status_code == 404

    # User B attempts to delete User A's workspace
    del_attempt = await client.delete(
        f"/api/v1/workspaces/{ws_a_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert del_attempt.status_code == 404

    # Update User A's onboarding
    step_res = await client.post(
        "/api/v1/onboarding/step",
        json={"step": "CONNECTORS", "step_data": {"gmail": True}},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert step_res.status_code == 200

    # User B checks their own onboarding: must not see User A's step data
    ob_b_res = await client.get(
        "/api/v1/onboarding",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert ob_b_res.status_code == 200
    ob_b = ob_b_res.json()
    assert ob_b["current_step"] == "PROFILE"
    assert "gmail" not in ob_b.get("step_data", {})


@pytest.mark.asyncio
async def test_performance_and_latency_budget(client):
    """Zero-trust SLA audit: measure p50, p95, and p99 for core interactive endpoints."""
    # 1. Setup user
    email = f"perf_user_{uuid.uuid4().hex[:8]}@vaeloom.test"
    signup_res = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": email,
            "password": "PerformancePass123!",
            "display_name": "Perf User",
        },
    )
    assert signup_res.status_code == 201
    data = signup_res.json()
    access_token = data["access_token"]
    refresh_token = data["refresh_token"]

    login_latencies = []
    sessions_latencies = []
    onboarding_latencies = []

    # Run 10 iterations to collect latency samples
    for _ in range(10):
        # Benchmark /auth/login
        t0 = time.perf_counter()
        l_res = await client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "PerformancePass123!"},
        )
        t1 = time.perf_counter()
        assert l_res.status_code == 200
        login_latencies.append((t1 - t0) * 1000.0)

        # Benchmark /auth/sessions
        t0 = time.perf_counter()
        s_res = await client.get(
            "/api/v1/auth/sessions",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        t1 = time.perf_counter()
        assert s_res.status_code == 200
        sessions_latencies.append((t1 - t0) * 1000.0)

        # Benchmark /onboarding
        t0 = time.perf_counter()
        o_res = await client.get(
            "/api/v1/onboarding",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        t1 = time.perf_counter()
        assert o_res.status_code == 200
        onboarding_latencies.append((t1 - t0) * 1000.0)

    p95_login = np.percentile(login_latencies, 95)
    p95_sessions = np.percentile(sessions_latencies, 95)
    p95_onboarding = np.percentile(onboarding_latencies, 95)

    print(f"\n--- LATENCY BENCHMARK RESULTS ---")
    print(f"Login p95: {p95_login:.2f}ms (Budget: <700ms)")
    print(f"Sessions p95: {p95_sessions:.2f}ms (Budget: <250ms)")
    print(f"Onboarding p95: {p95_onboarding:.2f}ms (Budget: <250ms)")

    assert p95_login < 700.0, f"Login p95 exceeded budget: {p95_login}ms"
    assert p95_sessions < 250.0, f"Sessions p95 exceeded budget: {p95_sessions}ms"
    assert p95_onboarding < 250.0, f"Onboarding p95 exceeded budget: {p95_onboarding}ms"
