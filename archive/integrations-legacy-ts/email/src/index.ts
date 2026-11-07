export { EmailIntegration } from './email.integration';
export type { EmailSummary } from './email.integration';
export { parseEmailConfig, emailConfigSchema } from './config';
export type { EmailConfig } from './config';
export { EmailIntegrationError, EmailAuthError, EmailTransportError } from './errors';
export { encryptSecret, decryptSecret } from './auth';
export type {
  Integration,
  IntegrationConfig,
  ConnectionResult,
  SyncResult,
  IngestedMemory,
} from './types';
