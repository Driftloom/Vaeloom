import { createTransport } from '../transport';

describe('Transport', () => {
  it('should create SSE transport', () => {
    const transport = createTransport({
      transport: 'sse',
      url: 'http://localhost:8080/mcp',
    });
    expect(transport).toBeDefined();
    expect(typeof transport.send).toBe('function');
    expect(typeof transport.close).toBe('function');
  });

  it('should throw for unsupported transport', () => {
    expect(() =>
      createTransport({
        transport: 'invalid' as never,
      }),
    ).toThrow('Unsupported transport');
  });
});
