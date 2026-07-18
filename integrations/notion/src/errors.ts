export class NotionIntegrationError extends Error {
  constructor(message: string, public readonly code: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'NotionIntegrationError';
  }
}

export class NotionAuthError extends NotionIntegrationError {
  constructor(message: string, cause?: unknown) {
    super(message, 'NOTION_AUTH_ERROR', cause);
    this.name = 'NotionAuthError';
  }
}

export class NotionApiError extends NotionIntegrationError {
  constructor(message: string, public readonly status?: number, cause?: unknown) {
    super(message, 'NOTION_API_ERROR', cause);
    this.name = 'NotionApiError';
  }
}
