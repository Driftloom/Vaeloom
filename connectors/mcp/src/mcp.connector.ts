import type {
  McpConfig,
  MCPTool,
  MCPResource,
  MCPResourceContent,
  MCPPrompt,
  MCPPromptResult,
  MCPCallResult,
  JSONRPCResponse,
} from './types';
import { createTransport, type Transport } from './transport';

export class McpConnector {
  private transport: Transport | null = null;
  private config: McpConfig | null = null;

  async connect(config: McpConfig): Promise<void> {
    this.config = config;
    this.transport = createTransport(config);
  }

  async listTools(): Promise<MCPTool[]> {
    const response = await this.sendRequest('tools/list');
    return (response.result as { tools: MCPTool[] }).tools;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<MCPCallResult> {
    const response = await this.sendRequest('tools/call', { name, arguments: args });
    return response.result as MCPCallResult;
  }

  async listResources(): Promise<MCPResource[]> {
    const response = await this.sendRequest('resources/list');
    return (response.result as { resources: MCPResource[] }).resources;
  }

  async readResource(uri: string): Promise<MCPResourceContent> {
    const response = await this.sendRequest('resources/read', { uri });
    return (response.result as { contents: MCPResourceContent[] }).contents[0]!;
  }

  async listPrompts(): Promise<MCPPrompt[]> {
    const response = await this.sendRequest('prompts/list');
    return (response.result as { prompts: MCPPrompt[] }).prompts;
  }

  async getPrompt(name: string, args?: Record<string, unknown>): Promise<MCPPromptResult> {
    const response = await this.sendRequest('prompts/get', { name, arguments: args });
    return response.result as MCPPromptResult;
  }

  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
    this.config = null;
  }

  private async sendRequest(
    method: string,
    params?: Record<string, unknown>,
    retryCount = 0,
  ): Promise<JSONRPCResponse> {
    if (!this.transport) throw new Error('Not connected. Call connect() first.');

    const response = await this.transport.send({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    });

    if (response.error) {
      if (response.error.code === -32000 && retryCount < 3) {
        const backoff = Math.pow(2, retryCount) * 1000;
        await delay(backoff);
        return this.sendRequest(method, params, retryCount + 1);
      }
      throw new Error(
        `MCP error ${response.error.code}: ${response.error.message}`,
      );
    }

    return response;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
