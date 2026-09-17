import { task } from '@trigger.dev/sdk';

export interface DocumentIngestPayload {
  workspace_id: string;
  document_id: string;
  filename?: string;
  requested_by?: string;
}

export const documentIngestTask = task({
  id: 'vaeloom.ingest-document',
  run: async (payload: DocumentIngestPayload) => {
    console.log(
      `[vaeloom.ingest-document] Ingesting document ${payload.document_id} in workspace ${payload.workspace_id}`,
    );
    const backendUrl = process.env['BACKEND_URL'] || 'http://localhost:8000';

    const response = await fetch(
      `${backendUrl}/api/v1/workspaces/${payload.workspace_id}/documents/${payload.document_id}/process`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspace_id: payload.workspace_id,
          document_id: payload.document_id,
        }),
      },
    );

    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to process document: ${response.statusText}`);
    }

    return {
      status: 'completed',
      document_id: payload.document_id,
      workspace_id: payload.workspace_id,
      timestamp: new Date().toISOString(),
    };
  },
});
