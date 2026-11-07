import { z } from 'zod';

export const emailConfigSchema = z.object({
  imapHost: z.string().min(1),
  imapPort: z.number().int().positive().default(993),
  smtpHost: z.string().min(1),
  smtpPort: z.number().int().positive().default(465),
  user: z.string().min(1),
  /** Plain app-password / account password. Stored encrypted at rest. */
  password: z.string().min(1),
  secure: z.boolean().default(true),
  useIdle: z.boolean().default(true),
});

export type EmailConfig = z.infer<typeof emailConfigSchema>;

export function parseEmailConfig(input: unknown): EmailConfig {
  return emailConfigSchema.parse(input);
}
