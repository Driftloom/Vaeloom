import { task } from '@trigger.dev/sdk';

export interface AgentRunPayload {
  workspace_id: string;
  user_id: string; // Mandatory non-null user identity
  agent_id: string;
  message: string;
  session_id?: string;
}

export const agentRunTask = task({
  id: 'vaeloom.run-agent',
  run: async (payload: AgentRunPayload) => {
    console.log(
      `[vaeloom.run-agent] Starting agent run for ${payload.agent_id} in workspace ${payload.workspace_id}`,
    );
    const backendUrl = process.env['BACKEND_URL'] || 'http://localhost:8000';

    const response = await fetch(`${backendUrl}/api/v1/orchestrator/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspace_id: payload.workspace_id,
        user_id: payload.user_id,
        agent_id: payload.agent_id,
        message: payload.message,
      }),
    });

    if (!response.ok) {
      throw new Error(`Agent run failed: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      status: 'success',
      agent_id: payload.agent_id,
      result,
      timestamp: new Date().toISOString(),
    };
  },
});
