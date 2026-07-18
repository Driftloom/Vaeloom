import { WebClient } from '@slack/web-api';

export interface SlackMessage {
  ts: string;
  user?: string;
  text?: string;
  botId?: string;
  threadTs?: string;
  blocks?: unknown[];
}

export interface SlackChannel {
  id: string;
  name: string;
  isChannel: boolean;
  isPrivate: boolean;
  isArchived: boolean;
  numMembers?: number;
}

export interface SlackEvent {
  type: string;
  event?: Record<string, unknown>;
  challenge?: string;
  teamId?: string;
}
