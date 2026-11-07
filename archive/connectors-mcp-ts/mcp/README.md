# @vaeloom/connector-mcp

Model Context Protocol (MCP) connector for Vaeloom.

## Features

- **Transport**: stdio (child process) and HTTP SSE
- **Tools**: list/call tools via JSON-RPC 2.0
- **Resources**: list/read resources
- **Prompts**: list/get prompts

## Usage

```typescript
import { McpConnector } from '@vaeloom/connector-mcp';

const connector = new McpConnector();
await connector.connect({
  transport: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
});

const tools = await connector.listTools();
const result = await connector.callTool('read_file', { path: '/tmp/test.txt' });
await connector.disconnect();
```
