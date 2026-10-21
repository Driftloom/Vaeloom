/**
 * The composio refresh/disconnect client methods are the only place the web app
 * describes what `POST /connectors/composio/refresh` and
 * `POST /connectors/composio/disconnect` actually return
 * (`apps/api/src/api/routers/connectors.py`). Both return service-shaped 200s
 * with two branches per endpoint, so a caller that guesses a single shape reads
 * fields the other branch does not carry.
 *
 * The file's transport approach is the one `api-client-capabilities.test.ts`
 * uses: no network mock — the stub replaces `api.request` (the one call
 * `ApiClient` delegates through) and applies the same `transformKeys` the real
 * transport applies to a 200 body, so the mapping asserted is the production
 * one.
 */

import { api, transformKeys } from '@/lib/api';
import {
  connectorsApi,
  type ComposioDisconnectResultRecord,
  type ComposioRefreshResultRecord,
} from '@/lib/api-client';

/** What the reconnection branch of `refresh_connection` puts on the wire. */
function refreshWire() {
  return {
    status: 'error',
    connected: false,
    error_code: 'COMPOSIO_AUTH_REQUIRED',
    message: "Composio app 'gmail' needs reconnection. Complete OAuth to refresh access.",
    app: 'gmail',
    auth_url: 'https://composio.test/reconnect',
    checked_at: '2026-09-21T00:00:00.000Z',
  };
}

/** What a `partial` disconnect result puts on the wire: some revoked, some not. */
function disconnectWire() {
  return {
    status: 'partial',
    app: 'gmail',
    revoked: ['account-1'],
    revocation_errors: [{ id: 'account-2', error: 'revocation returned HTTP 502' }],
    detail: null,
  };
}

function stubTransport(wire: unknown) {
  const spy = jest.spyOn(api, 'request');
  spy.mockImplementation(async () => transformKeys(JSON.parse(JSON.stringify(wire))) as never);
  return spy;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('connectorsApi.composio.refresh contract', () => {
  it('POSTs /connectors/composio/refresh with the body exactly { app, workspace_id }', async () => {
    const spy = stubTransport(refreshWire());

    await connectorsApi.composio.refresh('gmail', 'ws-1');

    expect(spy).toHaveBeenCalledTimes(1);
    const [path, init] = spy.mock.calls[0];
    expect(path).toBe('/connectors/composio/refresh');
    expect(init?.method).toBe('POST');
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({ app: 'gmail', workspace_id: 'ws-1' });
  });

  it('delivers the reconnection branch camelCased, which is what the result type declares', async () => {
    stubTransport(refreshWire());

    const result: ComposioRefreshResultRecord = await connectorsApi.composio.refresh(
      'gmail',
      'ws-1',
    );

    expect(result.status).toBe('error');
    expect(result.connected).toBe(false);
    expect(result.errorCode).toBe('COMPOSIO_AUTH_REQUIRED');
    expect(result.authUrl).toBe('https://composio.test/reconnect');
    expect(result.checkedAt).toBe('2026-09-21T00:00:00.000Z');
    expect(result.message).toBe(
      "Composio app 'gmail' needs reconnection. Complete OAuth to refresh access.",
    );
  });
});

describe('connectorsApi.composio.disconnect contract', () => {
  it('POSTs /connectors/composio/disconnect with the body exactly { app, workspace_id }', async () => {
    const spy = stubTransport(disconnectWire());

    await connectorsApi.composio.disconnect('gmail', 'ws-1');

    expect(spy).toHaveBeenCalledTimes(1);
    const [path, init] = spy.mock.calls[0];
    expect(path).toBe('/connectors/composio/disconnect');
    expect(init?.method).toBe('POST');
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({ app: 'gmail', workspace_id: 'ws-1' });
  });

  it('delivers revoked, revocationErrors and detail camelCased, which is what the result type declares', async () => {
    stubTransport(disconnectWire());

    const result: ComposioDisconnectResultRecord = await connectorsApi.composio.disconnect(
      'gmail',
      'ws-1',
    );

    expect(result.status).toBe('partial');
    expect(result.app).toBe('gmail');
    expect(result.revoked).toEqual(['account-1']);
    expect(result.revocationErrors).toEqual([
      { id: 'account-2', error: 'revocation returned HTTP 502' },
    ]);
    expect(result.detail).toBeNull();
  });
});

describe('connectorsApi.composio.refresh body honesty', () => {
  it('never sends extra fields: the body is exactly { app, workspace_id }', async () => {
    const spy = stubTransport(refreshWire());

    await connectorsApi.composio.refresh('googledrive', 'ws-42');

    const body = JSON.parse(String(spy.mock.calls[0][1]?.body));
    expect(body).toEqual({ app: 'googledrive', workspace_id: 'ws-42' });
  });
});
