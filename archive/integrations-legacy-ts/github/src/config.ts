import { z } from 'zod';

export const githubConfigSchema = z.object({
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  redirectUri: z.string().url().optional(),
  /** Personal Access Token (classic or fine-grained). */
  accessToken: z.string().optional(),
  /** GitHub App installation/auth. */
  appId: z.string().optional(),
  privateKey: z.string().optional(),
  installationId: z.string().optional(),
  scopes: z.array(z.string()).default(['repo', 'read:org']),
  webhookSecret: z.string().optional(),
});

export type GithubConfig = z.infer<typeof githubConfigSchema>;

export function parseGithubConfig(input: unknown): GithubConfig {
  return githubConfigSchema.parse(input);
}
