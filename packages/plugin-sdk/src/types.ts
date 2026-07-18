import type { UUID } from '@vaeloom/shared-types';

export interface PluginManifest {
  id: UUID;
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  homepage?: string;
  repository?: string;
  icon?: string;
  tags: string[];
  minAppVersion: string;
  permissions: PluginPermissions;
  capabilities: PluginCapability[];
  hooks: PluginHook[];
  configSchema?: Record<string, unknown>;
}

export interface PluginPermissions {
  memory: ('read' | 'write' | 'delete')[];
  agents: ('execute' | 'configure')[];
  events: ('publish' | 'subscribe')[];
  storage: ('read' | 'write')[];
  network: ('outbound' | 'webhook')[];
  files: ('read' | 'write')[];
}

export type PluginCapability =
  | 'memory:read'
  | 'memory:write'
  | 'memory:search'
  | 'agent:execute'
  | 'agent:create'
  | 'event:publish'
  | 'event:subscribe'
  | 'storage:kv'
  | 'storage:file'
  | 'network:http'
  | 'network:websocket'
  | 'ui:sidebar'
  | 'ui:modal'
  | 'ui:command'
  | 'auth:sso';

export type PluginHook =
  | 'onMemoryCreated'
  | 'onMemoryUpdated'
  | 'onMemoryDeleted'
  | 'onMemorySearched'
  | 'onAgentExecuted'
  | 'onEventPublished'
  | 'onUserAction'
  | 'onSyncStart'
  | 'onSyncComplete'
  | 'onPluginInit'
  | 'onPluginActivate'
  | 'onPluginDeactivate';

export interface PluginConfig {
  enabled: boolean;
  settings: Record<string, unknown>;
  permissions: PluginPermissions;
  webhookUrl?: string;
  proxyUrl?: string;
  rateLimit?: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
}

export interface PluginContext {
  pluginId: UUID;
  tenantId: UUID;
  userId: UUID;
  config: PluginConfig;
  api: PluginAPI;
  logger: PluginLogger;
  storage: PluginStorage;
}

export interface PluginAPI {
  memory: MemoryAPI;
  agent: AgentAPI;
  event: EventAPI;
  storage: StorageAPI;
  network: NetworkAPI;
  ui: UIAPI;
}

export interface MemoryAPI {
  create(data: unknown): Promise<unknown>;
  get(id: UUID): Promise<unknown>;
  search(query: string): Promise<unknown[]>;
  update(id: UUID, data: unknown): Promise<unknown>;
  delete(id: UUID): Promise<void>;
}

export interface AgentAPI {
  execute(agentId: UUID, input: unknown): Promise<unknown>;
  getStatus(agentId: UUID): Promise<string>;
  list(): Promise<unknown[]>;
}

export interface EventAPI {
  publish(type: string, payload: unknown): Promise<void>;
  subscribe(type: string, handler: (event: PluginEvent) => void): Promise<() => void>;
}

export interface StorageAPI {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

export interface NetworkAPI {
  request(config: NetworkRequest): Promise<NetworkResponse>;
  registerWebhook(path: string, handler: (req: unknown) => unknown): Promise<void>;
}

export interface NetworkRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
}

export interface NetworkResponse {
  status: number;
  headers: Record<string, string>;
  data: unknown;
}

export interface UIAPI {
  addSidebarItem(item: UISidebarItem): Promise<void>;
  registerCommand(command: UICommand): Promise<void>;
  showNotification(notification: UINotification): void;
}

export interface UISidebarItem {
  label: string;
  icon: string;
  href: string;
  badge?: number;
}

export interface UICommand {
  id: string;
  label: string;
  shortcut?: string;
  execute: () => void;
}

export interface UINotification {
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
}

export interface PluginLogger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  debug(msg: string, meta?: Record<string, unknown>): void;
}

export interface PluginStorage {
  kv: StorageAPI;
  file: FileStorage;
}

export interface FileStorage {
  read(path: string): Promise<Buffer>;
  write(path: string, data: Buffer): Promise<void>;
  delete(path: string): Promise<void>;
  list(dir: string): Promise<string[]>;
}

export interface PluginEvent {
  id: UUID;
  type: string;
  source: string;
  payload: Record<string, unknown>;
  timestamp: string;
  tenantId: UUID;
}

export interface PluginLifecycle {
  onInit?(ctx: PluginContext): Promise<void>;
  onActivate?(ctx: PluginContext): Promise<void>;
  onDeactivate?(ctx: PluginContext): Promise<void>;
  onUninstall?(ctx: PluginContext): Promise<void>;
}

export interface PluginMetadata {
  installedAt: string;
  updatedAt: string;
  enabled: boolean;
  config: Record<string, unknown>;
  usage: {
    totalExecutions: number;
    lastExecuted?: string;
    errors: number;
  };
}
