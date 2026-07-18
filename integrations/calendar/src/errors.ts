export class CalendarIntegrationError extends Error {
  constructor(message: string, public readonly code: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'CalendarIntegrationError';
  }
}

export class CalendarAuthError extends CalendarIntegrationError {
  constructor(message: string, cause?: unknown) {
    super(message, 'CAL_AUTH_ERROR', cause);
    this.name = 'CalendarAuthError';
  }
}

export class CalendarWebhookVerificationError extends CalendarIntegrationError {
  constructor(message = 'Invalid calendar webhook') {
    super(message, 'CAL_WEBHOOK_VERIFICATION', undefined);
    this.name = 'CalendarWebhookVerificationError';
  }
}

export class CalendarApiError extends CalendarIntegrationError {
  constructor(message: string, public readonly status?: number, cause?: unknown) {
    super(message, 'CAL_API_ERROR', cause);
    this.name = 'CalendarApiError';
  }
}
