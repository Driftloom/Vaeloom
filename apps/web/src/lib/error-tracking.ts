const SENTRY_DSN = process.env['NEXT_PUBLIC_SENTRY_DSN'] ?? '';

export interface ErrorContext {
  [key: string]: unknown;
}

export type EventName = string;
export type EventProperties = Record<string, unknown>;

export function isReportingEnabled(): boolean {
  const url = process.env['NEXT_PUBLIC_ERROR_REPORT_URL'];
  return Boolean(url && url.trim().length > 0);
}

class ErrorTrackerImpl {
  private userId: string | null = null;
  private userTraits: { email?: string; name?: string } | null = null;

  setUser(userId: string, traits?: { email?: string; name?: string }): void {
    this.userId = userId;
    this.userTraits = traits ?? null;
    console.info('[ErrorTracker] User set:', userId, traits ?? ''); // eslint-disable-line no-console
  }

  clearUser(): void {
    this.userId = null;
    this.userTraits = null;
    console.info('[ErrorTracker] User cleared'); // eslint-disable-line no-console
  }

  captureError(error: Error, context?: ErrorContext): boolean {
    if (!isReportingEnabled()) {
      console.error('[ErrorTracker]', error.message, context ?? ''); // eslint-disable-line no-console
      if (error.stack) {
        console.debug('[ErrorTracker] Stack:', error.stack); // eslint-disable-line no-console
      }
      if (SENTRY_DSN && typeof window !== 'undefined') {
        console.info('[ErrorTracker] Sentry DSN set but SDK not installed — console fallback'); // eslint-disable-line no-console
      }
      return false;
    }

    const endpoint = process.env['NEXT_PUBLIC_ERROR_REPORT_URL']!.trim();
    const envelope = {
      kind: 'error',
      message: error.message,
      stack: error.stack ?? '',
      context,
      occurredAt: new Date().toISOString(),
      ...(this.userId ? { userId: this.userId } : {}),
      ...(this.userTraits ? { userTraits: this.userTraits } : {}),
    };

    return this.transmit(endpoint, envelope);
  }

  captureEvent(name: EventName, properties?: EventProperties): boolean {
    if (!isReportingEnabled()) {
      return false;
    }

    const endpoint = process.env['NEXT_PUBLIC_ERROR_REPORT_URL']!.trim();
    const envelope = {
      kind: 'event',
      name,
      context: properties,
      occurredAt: new Date().toISOString(),
      ...(this.userId ? { userId: this.userId } : {}),
      ...(this.userTraits ? { userTraits: this.userTraits } : {}),
    };

    return this.transmit(endpoint, envelope);
  }

  private transmit(endpoint: string, payload: unknown): boolean {
    const body = JSON.stringify(payload);
    if (
      typeof window !== 'undefined' &&
      typeof window.navigator !== 'undefined' &&
      typeof window.navigator.sendBeacon === 'function'
    ) {
      try {
        const ok = window.navigator.sendBeacon(endpoint, body);
        if (ok) return true;
      } catch {
        // fall back to fetch
      }
    }

    try {
      if (typeof fetch === 'function') {
        void fetch(endpoint, {
          method: 'POST',
          body,
          keepalive: true,
          credentials: 'omit',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        return true;
      }
    } catch {
      return false;
    }

    return false;
  }
}

export const ErrorTracker = new ErrorTrackerImpl();

export function captureError(error: Error, context?: ErrorContext): boolean {
  return ErrorTracker.captureError(error, context);
}

export function captureEvent(name: EventName, properties?: EventProperties): boolean {
  return ErrorTracker.captureEvent(name, properties);
}
