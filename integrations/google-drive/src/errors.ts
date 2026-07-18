export class GoogleDriveIntegrationError extends Error {
  constructor(message: string, public readonly code: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'GoogleDriveIntegrationError';
  }
}

export class GoogleDriveAuthError extends GoogleDriveIntegrationError {
  constructor(message: string, cause?: unknown) {
    super(message, 'GDRIVE_AUTH_ERROR', cause);
    this.name = 'GoogleDriveAuthError';
  }
}

export class GoogleDriveWebhookVerificationError extends GoogleDriveIntegrationError {
  constructor(message = 'Invalid Google Drive webhook') {
    super(message, 'GDRIVE_WEBHOOK_VERIFICATION', undefined);
    this.name = 'GoogleDriveWebhookVerificationError';
  }
}

export class GoogleDriveApiError extends GoogleDriveIntegrationError {
  constructor(message: string, public readonly status?: number, cause?: unknown) {
    super(message, 'GDRIVE_API_ERROR', cause);
    this.name = 'GoogleDriveApiError';
  }
}
