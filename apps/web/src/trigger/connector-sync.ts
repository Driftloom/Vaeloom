import { task } from '@trigger.dev/sdk';

export interface ConnectorSyncPayload {
  workspace_id: string;
  connector_id: string;
  provider: string;
}

export const connectorSyncTask = task({
  id: 'vaeloom.sync-connector',
  run: async (payload: ConnectorSyncPayload) => {
    console.log(
      `[vaeloom.sync-connector] Syncing connector ${payload.connector_id} (${payload.provider})`,
    );
    const backendUrl = process.env['BACKEND_URL'] || 'http://localhost:8000';

    const response = await fetch(`${backendUrl}/api/v1/connectors/${payload.connector_id}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspace_id: payload.workspace_id,
      }),
    });

    if (!response.ok) {
      throw new Error(`Connector sync failed: ${response.statusText}`);
    }

    return {
      status: 'synced',
      connector_id: payload.connector_id,
      timestamp: new Date().toISOString(),
    };
  },
});
