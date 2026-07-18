import { McpConnector } from '../mcp.connector';

jest.mock('../transport', () => ({
  createTransport: jest.fn().mockReturnValue({
    send: jest.fn().mockResolvedValue({
      jsonrpc: '2.0' as const,
      id: 1,
      result: { tools: [] },
    }),
    close: jest.fn().mockResolvedValue(undefined),
  }),
}));

describe('McpConnector', () => {
  let connector: McpConnector;

  beforeEach(() => {
    connector = new McpConnector();
  });

  afterEach(async () => {
    await connector.disconnect();
  });

  it('should throw when not connected', async () => {
    await expect(connector.listTools()).rejects.toThrow('Not connected');
  });

  it('should connect and list tools', async () => {
    await connector.connect({
      transport: 'sse',
      url: 'http://localhost:8080/mcp',
    });

    const tools = await connector.listTools();
    expect(tools).toEqual([]);
  });

  it('should call a tool', async () => {
    const { createTransport } = await import('../transport');
    (createTransport as jest.Mock).mockReturnValue({
      send: jest.fn().mockResolvedValue({
        jsonrpc: '2.0' as const,
        id: 1,
        result: { content: [{ type: 'text' as const, text: 'done' }] },
      }),
      close: jest.fn(),
    });

    await connector.connect({
      transport: 'sse',
      url: 'http://localhost:8080/mcp',
    });

    const result = await connector.callTool('test', { arg: 1 });
    expect(result.content[0]?.text).toBe('done');
  });

  it('should disconnect cleanly', async () => {
    await connector.connect({
      transport: 'sse',
      url: 'http://localhost:8080/mcp',
    });

    await connector.disconnect();
    await expect(connector.listTools()).rejects.toThrow('Not connected');
  });
});
