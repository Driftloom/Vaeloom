export class EmailIntegrationError extends Error {
  constructor(message: string, public readonly code: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'EmailIntegrationError';
  }
}

export class EmailAuthError extends EmailIntegrationError {
  constructor(message: string, cause?: unknown) {
    super(message, 'EMAIL_AUTH_ERROR', cause);
    this.name = 'EmailAuthError';
  }
}

export class EmailTransportError extends EmailIntegrationError {
  constructor(message: string, cause?: unknown) {
    super(message, 'EMAIL_TRANSPORT_ERROR', cause);
    this.name = 'EmailTransportError';
  }
}
