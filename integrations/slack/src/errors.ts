export class SlackIntegrationError extends Error {
  constructor(
    override message: string,
    public readonly code: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'SlackIntegrationError';
  }
}

export class SlackAuthError extends SlackIntegrationError {
  constructor(message: string, cause?: unknown) {
    super(message, 'SLACK_AUTH_ERROR', cause);
    this.name = 'SlackAuthError';
  }
}

export class SlackWebhookVerificationError extends SlackIntegrationError {
  constructor(message = 'Invalid Slack webhook signature') {
    super(message, 'SLACK_WEBHOOK_VERIFICATION', undefined);
    this.name = 'SlackWebhookVerificationError';
  }
}

export class SlackApiError extends SlackIntegrationError {
  constructor(message: string, public readonly status?: number, cause?: unknown) {
    super(message, 'SLACK_API_ERROR', cause);
    this.name = 'SlackApiError';
  }
}
