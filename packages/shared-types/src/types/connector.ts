export type ConnectorProvider = 'gmail' | 'github' | 'drive' | 'notion' | 'calendar' | 'slack';

export type ConnectorStatus = 'connected' | 'disconnected' | 'error' | 'syncing';

export interface Connector {
  id: string;
  workspaceId: string;
  provider: ConnectorProvider;
  status: ConnectorStatus;
  accountEmail?: string;
  lastSyncAt?: string;
  errorDetail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectProviderDto {
  provider: ConnectorProvider;
  code: string;
  redirectUri: string;
}

export interface SyncConnectorDto {
  connectorId: string;
  fullSync?: boolean;
}
