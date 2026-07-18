export class GithubIntegrationError extends Error {
  constructor(message: string, public readonly code: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'GithubIntegrationError';
  }
}

export class GithubAuthError extends GithubIntegrationError {
  constructor(message: string, cause?: unknown) {
    super(message, 'GITHUB_AUTH_ERROR', cause);
    this.name = 'GithubAuthError';
  }
}

export class GithubWebhookVerificationError extends GithubIntegrationError {
  constructor(message = 'Invalid GitHub webhook signature') {
    super(message, 'GITHUB_WEBHOOK_VERIFICATION', undefined);
    this.name = 'GithubWebhookVerificationError';
  }
}

export class GithubApiError extends GithubIntegrationError {
  constructor(message: string, public readonly status?: number, cause?: unknown) {
    super(message, 'GITHUB_API_ERROR', cause);
    this.name = 'GithubApiError';
  }
}
