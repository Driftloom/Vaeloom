import { z } from 'zod';

export const slackConfigSchema = z.object({
  clientId: z.string().min(1, 'clientId is required'),
  clientSecret: z.string().min(1, 'clientSecret is required'),
  signingSecret: z.string().min(1, 'signingSecret is required'),
  redirectUri: z.string().url('redirectUri must be a valid URL'),
  botToken: z.string().optional(),
  scopes: z
    .array(z.string())
    .min(1)
    .default([
      'channels:read',
      'channels:history',
      'chat:write',
      'users:read',
      'im:write',
    ]),
});

export type SlackConfig = z.infer<typeof slackConfigSchema>;

export function parseSlackConfig(input: unknown): SlackConfig {
  return slackConfigSchema.parse(input);
}
