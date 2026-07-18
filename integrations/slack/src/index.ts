export { SlackIntegration } from './slack.integration';
export { SlackAuthClient } from './auth-client';
export { parseSlackConfig, slackConfigSchema } from './config';
export type { SlackConfig } from './config';
export {
  SlackIntegrationError,
  SlackAuthError,
  SlackApiError,
  SlackWebhookVerificationError,
} from './errors';
export {
  encryptSecret,
  decryptSecret,
  verifySlackSignature,
} from './auth';
export type {
  Integration,
  IntegrationConfig,
  ConnectionResult,
  SyncResult,
  IngestedMemory,
} from './types';
export type { SlackMessage, SlackChannel, SlackEvent } from './slack.types';
