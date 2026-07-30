const SENTRY_DSN = process.env['NEXT_PUBLIC_SENTRY_DSN'] ?? '';

interface ErrorContext {
  [key: string]: unknown;
}

type EventName = string;
type EventProperties = Record<string, unknown>;

class ErrorTrackerImpl {
  private enabled: boolean;

  constructor() {
    this.enabled = !!SENTRY_DSN;
  }

  captureError(error: Error, context?: ErrorContext): void {
    if (this.enabled && typeof window !== 'undefined') {
      // Sentry integration: captureException would go here
      // window.Sentry?.captureException(error, { extra: context });
    }
    console.error('[ErrorTracker]', error.message, context ?? '');
    if (error.stack) {
      console.debug('[ErrorTracker] Stack:', error.stack);
    }
  }

  captureEvent(name: EventName, properties?: EventProperties): void {
    if (this.enabled && typeof window !== 'undefined') {
      // Sentry integration: captureEvent would go here
      // window.Sentry?.captureEvent({ message: name, extra: properties });
    }
    console.info('[EventTracker]', name, properties ?? '');
  }

  setUser(userId: string, traits?: { email?: string; name?: string }): void {
    if (this.enabled && typeof window !== 'undefined') {
      // window.Sentry?.setUser({ id: userId, email: traits?.email, username: traits?.name });
    }
    console.info('[ErrorTracker] User set:', userId, traits ?? '');
  }

  clearUser(): void {
    if (this.enabled && typeof window !== 'undefined') {
      // window.Sentry?.setUser(null);
    }
  }
}

export const ErrorTracker = new ErrorTrackerImpl();

export function captureError(error: Error, context?: ErrorContext): void {
  ErrorTracker.captureError(error, context);
}

export function captureEvent(name: EventName, properties?: EventProperties): void {
  ErrorTracker.captureEvent(name, properties);
}
