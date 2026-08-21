const SENTRY_DSN = process.env['NEXT_PUBLIC_SENTRY_DSN'] ?? '';

interface ErrorContext {
  [key: string]: unknown;
}

type EventName = string;
type EventProperties = Record<string, unknown>;

/**
 * MVP error tracking — console-only.
 * Enable Sentry by: `pnpm add @sentry/nextjs` and setting NEXT_PUBLIC_SENTRY_DSN,
 * then replace the console calls below with `Sentry.captureException` etc.
 * Keeping this honest (no fake Sentry) satisfies FW-022.
 */
class ErrorTrackerImpl {
  captureError(error: Error, context?: ErrorContext): void {
    console.error('[ErrorTracker]', error.message, context ?? ''); // eslint-disable-line no-console
    if (error.stack) {
      console.debug('[ErrorTracker] Stack:', error.stack); // eslint-disable-line no-console
    }
    if (SENTRY_DSN && typeof window !== 'undefined') {
      console.info('[ErrorTracker] Sentry DSN set but SDK not installed — console fallback'); // eslint-disable-line no-console
    }
  }

  captureEvent(name: EventName, properties?: EventProperties): void {
    console.info('[EventTracker]', name, properties ?? ''); // eslint-disable-line no-console
  }

  setUser(userId: string, traits?: { email?: string; name?: string }): void {
    console.info('[ErrorTracker] User set:', userId, traits ?? ''); // eslint-disable-line no-console
  }

  clearUser(): void {
    console.info('[ErrorTracker] User cleared'); // eslint-disable-line no-console
  }
}

export const ErrorTracker = new ErrorTrackerImpl();

export function captureError(error: Error, context?: ErrorContext): void {
  ErrorTracker.captureError(error, context);
}

export function captureEvent(name: EventName, properties?: EventProperties): void {
  ErrorTracker.captureEvent(name, properties);
}
