import { z } from 'zod';

export const googleDriveConfigSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUri: z.string().url(),
  /** OAuth access token. */
  accessToken: z.string().optional(),
  /** OAuth refresh token used to mint new access tokens. */
  refreshToken: z.string().optional(),
});

export type GoogleDriveConfig = z.infer<typeof googleDriveConfigSchema>;

export function parseGoogleDriveConfig(input: unknown): GoogleDriveConfig {
  return googleDriveConfigSchema.parse(input);
}
