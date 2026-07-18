export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  location?: string;
  htmlLink?: string;
  status?: string;
}

export type NewCalendarEvent = Omit<CalendarEvent, 'id' | 'htmlLink' | 'status'>;

export interface CalendarWebhookPayload {
  channelId?: string;
  resourceToken?: string;
  expectedChannelId?: string;
  expectedResourceToken?: string;
  subscriptionId?: string;
  validationToken?: string;
  resource?: Record<string, unknown>;
}
