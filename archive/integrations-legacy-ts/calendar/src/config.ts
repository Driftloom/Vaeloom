import { z } from 'zod';

export const calendarConfigSchema = z.discriminatedUnion('backend', [
  z.object({
    backend: z.literal('google'),
    clientId: z.string().min(1),
    clientSecret: z.string().min(1),
    redirectUri: z.string().url(),
    accessToken: z.string().optional(),
    refreshToken: z.string().optional(),
  }),
  z.object({
    backend: z.literal('outlook'),
    clientId: z.string().min(1),
    clientSecret: z.string().min(1),
    redirectUri: z.string().url(),
    accessToken: z.string().optional(),
    refreshToken: z.string().optional(),
    tenantId: z.string().default('common'),
  }),
]);

export type CalendarConfig = z.infer<typeof calendarConfigSchema>;

export function parseCalendarConfig(input: unknown): CalendarConfig {
  return calendarConfigSchema.parse(input);
}
