export type McpTransportType = 'stdio' | 'sse';

export interface McpConfig {
  transport: McpTransportType;
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPResource {
  uri: string;
  name: string;
  mimeType?: string;
  description?: string;
}

export interface MCPResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: MCPPromptArg[];
}

export interface MCPPromptArg {
  name: string;
  description?: string;
  required?: boolean;
}

export interface MCPPromptResult {
  description?: string;
  messages: MCPMessage[];
}

export interface MCPMessage {
  role: 'user' | 'assistant';
  content: MCPContent;
}

export interface MCPContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
}

export interface MCPCallResult {
  content: MCPContent[];
  isError?: boolean;
}

export interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}
