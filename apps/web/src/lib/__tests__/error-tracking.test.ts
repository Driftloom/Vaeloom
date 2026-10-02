/**
 * Error tracking (plan T8).
 *
 * The prior implementation was console-only yet the crash UI still told users
 * "our team has been notified" — a claim with no destination behind it. These
 * tests pin the two properties that make the new behaviour honest:
 *   1. With no `NEXT_PUBLIC_ERROR_REPORT_URL`, nothing is sent and
 *      `isReportingEnabled()` is false, so the UI must not claim a report went out.
 *   2. With a destination configured, an error is actually transmitted over the
 *      network (beacon first, fetch fallback) carrying a real envelope.
 */

import { ErrorTracker, captureError, captureEvent, isReportingEnabled } from '@/lib/error-tracking';

const ENDPOINT = 'https://collector.test.invalid/client-errors';

let beaconSpy: jest.Mock;
let fetchSpy: jest.Mock;

beforeEach(() => {
  delete process.env['NEXT_PUBLIC_ERROR_REPORT_URL'];
  beaconSpy = jest.fn(() => true);
  fetchSpy = jest.fn(() => Promise.resolve({ ok: true }));
  Object.defineProperty(window.navigator, 'sendBeacon', {
    value: beaconSpy,
    configurable: true,
  });
  (global as unknown as { fetch: jest.Mock }).fetch = fetchSpy;
});

describe('isReportingEnabled', () => {
  it('is false with no destination configured', () => {
    expect(isReportingEnabled()).toBe(false);
  });

  it('is true only when a non-blank endpoint is set', () => {
    process.env['NEXT_PUBLIC_ERROR_REPORT_URL'] = '   ';
    expect(isReportingEnabled()).toBe(false);
    process.env['NEXT_PUBLIC_ERROR_REPORT_URL'] = ENDPOINT;
    expect(isReportingEnabled()).toBe(true);
  });
});

describe('captureError — console fallback (no destination)', () => {
  it('does not transmit and reports "not sent"', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});

    const sent = captureError(new Error('boom'), { route: 'settings' });

    expect(sent).toBe(false);
    expect(beaconSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalledWith('[ErrorTracker]', 'boom', { route: 'settings' });
    errSpy.mockRestore();
  });
});

describe('captureError — real destination', () => {
  beforeEach(() => {
    process.env['NEXT_PUBLIC_ERROR_REPORT_URL'] = ENDPOINT;
  });

  it('dispatches via sendBeacon and returns true', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const sent = captureError(new Error('kaboom'), { route: 'vault' });
    errSpy.mockRestore();

    expect(sent).toBe(true);
    // When a destination is wired, it must not also spam the console path.
    expect(errSpy).not.toHaveBeenCalled();
    expect(beaconSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    const [url] = beaconSpy.mock.calls[0] as [string, unknown];
    expect(url).toBe(ENDPOINT);
  });

  it('sends a structured envelope and falls back to fetch keepalive when beacon is unavailable', () => {
    Object.defineProperty(window.navigator, 'sendBeacon', {
      value: undefined,
      configurable: true,
    });
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const sent = captureError(new Error('no-beacon'), { route: 'tasks' });
    errSpy.mockRestore();

    expect(sent).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(ENDPOINT);
    expect(init.method).toBe('POST');
    expect(init.keepalive).toBe(true);
    expect(init.credentials).toBe('omit');

    const envelope = JSON.parse(init.body as string);
    expect(envelope).toMatchObject({
      kind: 'error',
      message: 'no-beacon',
      context: { route: 'tasks' },
    });
    expect(typeof envelope.occurredAt).toBe('string');
    expect(envelope.stack).toContain('no-beacon');
  });

  it('attaches the signed-in user to the envelope', () => {
    Object.defineProperty(window.navigator, 'sendBeacon', {
      value: undefined,
      configurable: true,
    });
    ErrorTracker.setUser('user-42');
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    captureError(new Error('with-user'));
    errSpy.mockRestore();

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).userId).toBe('user-42');
  });
});

describe('captureEvent', () => {
  it('is a no-op signal when reporting is disabled', () => {
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    expect(captureEvent('cta_clicked', { id: 'x' })).toBe(false);
    expect(beaconSpy).not.toHaveBeenCalled();
    infoSpy.mockRestore();
  });

  it('transmits an event envelope when a destination is set', () => {
    process.env['NEXT_PUBLIC_ERROR_REPORT_URL'] = ENDPOINT;
    Object.defineProperty(window.navigator, 'sendBeacon', {
      value: undefined,
      configurable: true,
    });
    expect(captureEvent('cta_clicked', { id: 'x' })).toBe(true);
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const envelope = JSON.parse(init.body as string);
    expect(envelope.kind).toBe('event');
    expect(envelope.name).toBe('cta_clicked');
    expect(envelope.context).toEqual({ id: 'x' });
  });
});
