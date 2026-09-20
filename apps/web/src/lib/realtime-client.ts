import { API_BASE, getToken } from './api';

export type RealtimeMessageType =
  | 'AUTH'
  | 'AUTH_OK'
  | 'PING'
  | 'PONG'
  | 'SUBSCRIBE'
  | 'SUBSCRIBED'
  | 'UNSUBSCRIBE'
  | 'UNSUBSCRIBED'
  | 'TYPING'
  | 'PRESENCE'
  | 'CHANNEL_MESSAGE'
  | 'ERROR';

export interface RealtimeMessage<T = unknown> {
  type: RealtimeMessageType;
  channel?: string;
  sender_id?: string;
  user_id?: string;
  event?: string;
  status?: string;
  is_typing?: boolean;
  data?: T;
  token?: string;
  code?: string;
  message?: string;
  timestamp?: string;
}

export type RealtimeEventHandler<T = unknown> = (msg: RealtimeMessage<T>) => void;

export class RealtimeClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private listeners: Map<string, Set<RealtimeEventHandler>> = new Map();
  private subscribedChannels: Set<string> = new Set();
  private isExplicitlyClosed = false;

  constructor(customUrl?: string) {
    if (customUrl) {
      this.url = customUrl;
    } else {
      const base = API_BASE.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
      this.url = `${base}/api/v1/realtime/ws`;
    }
  }

  public connect(): void {
    if (typeof window === 'undefined') return;
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.isExplicitlyClosed = false;
    const token = getToken();
    const connectUrl = token ? `${this.url}?token=${encodeURIComponent(token)}` : this.url;

    try {
      this.ws = new WebSocket(connectUrl);
    } catch (err) {
      this.emit('ERROR', {
        type: 'ERROR',
        message: err instanceof Error ? err.message : 'Failed to create WebSocket',
      });
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.emit('CONNECT', { type: 'AUTH_OK', message: 'Connected' });
      this.startHeartbeat();

      // Re-subscribe to any channels previously registered
      for (const ch of this.subscribedChannels) {
        this.send({ type: 'SUBSCRIBE', channel: ch });
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: RealtimeMessage = JSON.parse(event.data);
        if (msg.type === 'PONG') return;
        this.emit(msg.type, msg);
        if (msg.channel) {
          this.emit(`channel:${msg.channel}`, msg);
        }
      } catch {
        // Non-JSON message received
      }
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      this.emit('DISCONNECT', { type: 'ERROR', message: 'Disconnected' });
      if (!this.isExplicitlyClosed) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (err) => {
      this.emit('ERROR', {
        type: 'ERROR',
        message: 'WebSocket encountered an error',
        data: err,
      });
    };
  }

  public disconnect(): void {
    this.isExplicitlyClosed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public subscribe(channel: string): void {
    this.subscribedChannels.add(channel);
    if (this.isConnected()) {
      this.send({ type: 'SUBSCRIBE', channel });
    }
  }

  public unsubscribe(channel: string): void {
    this.subscribedChannels.delete(channel);
    if (this.isConnected()) {
      this.send({ type: 'UNSUBSCRIBE', channel });
    }
  }

  public sendTyping(channel: string, isTyping: boolean): void {
    this.send({ type: 'TYPING', channel, is_typing: isTyping });
  }

  public sendPresence(status: 'online' | 'busy' | 'away' | 'offline'): void {
    this.send({ type: 'PRESENCE', status });
  }

  public send(msg: RealtimeMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  public on(event: string, handler: RealtimeEventHandler): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  public off(event: string, handler: RealtimeEventHandler): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  public isConnected(): boolean {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  private emit(event: string, msg: RealtimeMessage): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((h) => {
        try {
          h(msg);
        } catch (e) {
          console.error(`Error in realtime event handler for ${event}:`, e);
        }
      });
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.isConnected()) {
        this.send({ type: 'PING' });
      }
    }, 25000);
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }
}

// Global singleton instance for shared app-wide realtime usage
export const realtimeClient = new RealtimeClient();
