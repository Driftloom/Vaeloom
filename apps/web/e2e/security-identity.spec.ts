import { expect, test, type Page } from '@playwright/test';
import { apiRequest, login, SECOND_USER } from './helpers';

/**
 * Identity & session security paths that previously had zero frontend test
 * coverage (plan finding E8 / gate G4). Every assertion targets the server's
 * authoritative behaviour, exercised through the app's own authenticated
 * surface, so these are real acceptance proofs — not UI-shape checks:
 *
 *   • Session revoke — a listed session can be revoked and drops out of the
 *     active set, while the caller's own current session is left intact.
 *   • Invite reject  — an invitation token is a bearer credential that is only
 *     honoured for the account it was issued to (identity binding).
 *   • Invite revoke  — a revoked invitation can no longer be redeemed, even by
 *     its intended recipient.
 *   • Idempotency    — an invitation is single-use: a duplicate submit is
 *     refused, and concurrent submits cannot mint two memberships.
 *
 * Design notes:
 *   - Calls are made with `apiRequest`, which authenticates through the app's
 *     HttpOnly session cookies (`credentials: 'include'`), not a fabricated
 *     bearer token. A cross-account probe therefore uses a SECOND browser
 *     context that has really logged in as the other user.
 *   - The suite runs against SQLite (see playwright.config.ts), where
 *     PostgreSQL RLS is inert; these tests therefore assert the application
 *     layer's identity binding and single-use consumption, not the RLS policy.
 *   - Session revocation is verified at the source of truth (the active-session
 *     list reflects the persisted status) rather than by asserting a 401 on the
 *     revoked token: the e2e stack runs without the Redis revocation fast-path,
 *     so an already-issued access token stays valid until it expires. Claiming
 *     an immediate 401 here would test the harness, not the product.
 */

interface OrganizationCreateResponse {
  id: string;
}

interface InvitationCreateResponse {
  id: string;
  token: string;
  email: string;
  status: string;
}

interface SessionRow {
  id: string;
  is_current: boolean;
  status: string;
}

interface SessionListBody {
  sessions: SessionRow[];
}

// The seed helpers run inside a single test, so two orgs created in the same
// millisecond would otherwise collide on name; a module counter keeps them
// distinct without depending on wall-clock resolution.
let orgCounter = 0;

/** Create an organization as the (admin) caller and invite `inviteeEmail`. */
async function createOrgWithInvite(
  page: Page,
  inviteeEmail: string,
): Promise<{ orgId: string; invite: InvitationCreateResponse }> {
  orgCounter += 1;
  const org = await apiRequest<OrganizationCreateResponse>(page, {
    method: 'POST',
    path: '/api/v1/organizations',
    body: { name: `pw-identity-org-${Date.now()}-${orgCounter}`, type: 'department' },
  });
  expect(org.status, `organization seed failed: ${org.text}`).toBe(201);
  const orgId = org.json?.id;
  expect(typeof orgId, 'created organization carried no id').toBe('string');

  const invite = await apiRequest<InvitationCreateResponse>(page, {
    method: 'POST',
    path: `/api/v1/organizations/${orgId}/invitations`,
    body: { email: inviteeEmail, role: 'member' },
  });
  expect(invite.status, `invitation seed failed: ${invite.text}`).toBe(201);
  const inviteBody = invite.json;
  expect(typeof inviteBody?.token, 'invitation carried no raw token').toBe('string');
  expect(typeof inviteBody?.id, 'invitation carried no id').toBe('string');
  return { orgId: orgId as string, invite: inviteBody as InvitationCreateResponse };
}

async function listSessions(page: Page): Promise<SessionRow[]> {
  const res = await apiRequest<SessionListBody>(page, {
    method: 'GET',
    path: '/api/v1/auth/sessions',
  });
  expect(res.status, `session list failed: ${res.text}`).toBe(200);
  return res.json?.sessions ?? [];
}

function acceptPath(token: string): string {
  return `/api/v1/organizations/invitations/${encodeURIComponent(token)}/accept`;
}

test.describe('identity & session security', () => {
  test('revoking a session removes it while the current session survives', async ({
    page,
    browser,
  }) => {
    // Two full UI logins (primary + a second context) plus several session
    // reads; in `next dev` this test also absorbs the cold route compilation,
    // so it gets a larger budget than the default.
    test.setTimeout(240_000);
    // Two independent logins = two active sessions for the same account.
    await login(page);
    const otherCtx = await browser.newContext();
    const otherPage = await otherCtx.newPage();
    try {
      await login(otherPage);

      // Identify the *other* context's own current session from inside it.
      const otherSessions = await listSessions(otherPage);
      const otherCurrent = otherSessions.find((s) => s.is_current);
      expect(otherCurrent, 'the second login never registered as an active session').toBeTruthy();

      // From the primary session, both rows are visible and the primary's own
      // session is the current one.
      const primarySessions = await listSessions(page);
      const primaryCurrent = primarySessions.find((s) => s.is_current);
      expect(primaryCurrent, 'primary session is not marked current').toBeTruthy();
      expect(
        primarySessions.some((s) => s.id === otherCurrent?.id),
        'the second session is not listed for revocation',
      ).toBe(true);

      const revoke = await apiRequest(page, {
        method: 'DELETE',
        path: `/api/v1/auth/sessions/${encodeURIComponent(otherCurrent!.id)}`,
      });
      expect(revoke.status, `revoke did not return 204: ${revoke.text}`).toBe(204);

      const after = await listSessions(page);
      expect(
        after.some((s) => s.id === otherCurrent?.id),
        'a revoked session still appears in the active list',
      ).toBe(false);
      expect(
        after.some((s) => s.id === primaryCurrent?.id),
        'revoking another session must not revoke the caller’s own session',
      ).toBe(true);
    } finally {
      await otherCtx.close();
    }
  });

  test('an invitation token is rejected for an account other than its recipient', async ({
    page,
  }) => {
    await login(page); // audit — the inviter/admin
    const { invite } = await createOrgWithInvite(page, SECOND_USER.email);

    // audit holds a perfectly valid token but is NOT the recipient. A bearer
    // token alone must not be enough to mint a membership in someone else's
    // organization.
    const res = await apiRequest(page, { method: 'POST', path: acceptPath(invite.token) });
    expect(res.status, `cross-account accept was not rejected: ${res.text}`).toBe(403);
    expect(res.text.toLowerCase()).toContain('different email');
  });

  test('a revoked invitation can no longer be redeemed, even by its recipient', async ({
    page,
    browser,
  }) => {
    await login(page); // audit invites demo, then revokes it
    const { invite } = await createOrgWithInvite(page, SECOND_USER.email);

    const revoke = await apiRequest<{ ok: boolean; status: string }>(page, {
      method: 'DELETE',
      path: `/api/v1/organizations/invitations/${encodeURIComponent(invite.id)}`,
    });
    expect(revoke.status, `invitation revoke failed: ${revoke.text}`).toBe(200);
    expect(revoke.json?.status).toBe('revoked');

    // The intended recipient now attempts to redeem the (revoked) token; it is
    // no longer `pending`, so the redemption must be refused.
    const ctx = await browser.newContext();
    const demo = await ctx.newPage();
    try {
      await login(demo, SECOND_USER);
      const accept = await apiRequest(demo, { method: 'POST', path: acceptPath(invite.token) });
      expect(accept.status, `a revoked token was still redeemable: ${accept.text}`).toBe(400);
    } finally {
      await ctx.close();
    }
  });

  test('an invitation is single-use: duplicate and concurrent submits cannot join twice', async ({
    page,
    browser,
  }) => {
    await login(page); // audit issues two invitations to demo
    const sequential = await createOrgWithInvite(page, SECOND_USER.email);
    const concurrent = await createOrgWithInvite(page, SECOND_USER.email);

    const ctx = await browser.newContext();
    const demo = await ctx.newPage();
    try {
      await login(demo, SECOND_USER);

      // Sequential duplicate submit: first redeem succeeds.
      const first = await apiRequest<{ status: string }>(demo, {
        method: 'POST',
        path: acceptPath(sequential.invite.token),
      });
      expect(first.status, `legit accept failed: ${first.text}`).toBe(200);
      expect(first.json?.status).toBe('accepted');

      // The second submit of the SAME token must be refused — proving the
      // token is consumed (no second membership), which is the idempotency
      // property for a duplicate submit. Once consumed the row is no longer
      // `pending`, so the lookup misses and the endpoint answers 400
      // ("invalid or expired"); a genuine concurrent race answers 400
      // ("already used"). Either way it is refused, never re-applied.
      const replay = await apiRequest(demo, {
        method: 'POST',
        path: acceptPath(sequential.invite.token),
      });
      expect(replay.status, `replay of a used token was accepted: ${replay.text}`).toBe(400);
      expect(replay.text.toLowerCase()).toMatch(/already|invalid|expired/);

      // Concurrent submits of one token: the atomic conditional update must let
      // exactly one redeem. The loser is refused (400, either "already used" or
      // "invalid or expired"); under SQLite write contention it may instead
      // surface a transient lock (500), but it must never also succeed.
      const [r1, r2] = await Promise.all([
        apiRequest<{ status: string }>(demo, {
          method: 'POST',
          path: acceptPath(concurrent.invite.token),
        }),
        apiRequest<{ status: string }>(demo, {
          method: 'POST',
          path: acceptPath(concurrent.invite.token),
        }),
      ]);
      const successes = [r1, r2].filter((r) => r.status === 200);
      // The invariant is "cannot join twice": never more than one 200. Under
      // SQLite write contention the loser may be refused with 400 or a
      // transient lock 500; both are acceptable, two successes are not.
      expect(
        successes.length,
        `concurrent accepts both succeeded: ${r1.text} | ${r2.text}`,
      ).toBeLessThanOrEqual(1);
      for (const ok of successes) {
        expect(ok.json?.status).toBe('accepted');
      }
    } finally {
      await ctx.close();
    }
  });

  test("a non-member cannot enumerate or administer another user's organization", async ({
    page,
    browser,
  }) => {
    test.setTimeout(180_000);
    // audit creates an organization and invites someone, giving the org real
    // server-side state (an invitation row + an admin-gated listing).
    await login(page);
    const { orgId, invite } = await createOrgWithInvite(page, SECOND_USER.email);

    const ctx = await browser.newContext();
    const outsider = await ctx.newPage();
    try {
      await login(outsider, SECOND_USER); // demo — its own workspace, but NOT a
      // member of audit's organization

      // The organization's invitation roster (which exposes invitee email
      // addresses) is admin-gated server-side. demo holds no role in audit's
      // organization, so the write/read must be refused by the server — hiding
      // the control in the UI is not an authorization check. The refusal is
      // 403 (not a member/admin) or 404 (scoped lookup); either way, nothing
      // about audit's invitation may leak to demo.
      const listed = await apiRequest(outsider, {
        method: 'GET',
        path: `/api/v1/organizations/${orgId}/invitations`,
      });
      expect(
        [403, 404],
        `non-member invitation listing was not denied: ${listed.status} ${listed.text}`,
      ).toContain(listed.status);
      expect(listed.text).not.toContain(invite.email);

      // And demo must not be able to revoke audit's invitation either — an
      // invitation is administered only by its owning organization's members.
      const revoked = await apiRequest(outsider, {
        method: 'DELETE',
        path: `/api/v1/organizations/invitations/${encodeURIComponent(invite.id)}`,
      });
      expect(
        [403, 404],
        `non-member invitation revoke was not denied: ${revoked.status} ${revoked.text}`,
      ).toContain(revoked.status);
    } finally {
      await ctx.close();
    }

    // The invitation still belongs to audit and is untouched by the outsider's
    // failed probes — the owner can still see it.
    const stillPresent = await apiRequest(page, {
      method: 'GET',
      path: `/api/v1/organizations/${orgId}/invitations`,
    });
    expect(stillPresent.status, `owner listing failed: ${stillPresent.text}`).toBe(200);
    expect(JSON.stringify(stillPresent.json)).toContain(invite.email);
  });
});
