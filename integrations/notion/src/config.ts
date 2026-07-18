import { z } from 'zod';

export const notionConfigSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUri: z.string().url(),
  /** OAuth access token obtained via the Notion OAuth flow. */
  accessToken: z.string().optional(),
  /** Bot/integration token (internal integration). */
  botToken: z.string().optional(),
});

export type NotionConfig = z.infer<typeof notionConfigSchema>;

export function parseNotionConfig(input: unknown): NotionConfig {
  return notionConfigSchema.parse(input);
}
