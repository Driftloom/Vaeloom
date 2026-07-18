import { execute } from '../index';
import type { PluginContext } from '@vaeloom/plugin-sdk';

const mockContext: PluginContext = {
  pluginId: '00000000-0000-0000-0000-000000000005' as const,
  tenantId: '00000000-0000-0000-0000-000000000001' as const,
  userId: '00000000-0000-0000-0000-000000000001' as const,
  config: {
    enabled: true,
    settings: {},
    permissions: { memory: [], agents: [], events: [], storage: [], network: [], files: [] },
  },
  api: {} as never,
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  storage: {} as never,
};

describe('tag-generator', () => {
  it('should extract tags by term frequency', async () => {
    const text = [
      'Machine learning is transforming technology.',
      'Artificial intelligence and machine learning are related.',
      'Deep learning is a subset of machine learning.',
    ].join(' ');

    const result = await execute(mockContext, { text, maxTags: 3 });

    expect(result.tags.length).toBeLessThanOrEqual(3);
    expect(result.tags).toContain('learning');
    expect(result.counts).toBeDefined();
  });

  it('should respect maxTags parameter', async () => {
    const text = 'apple banana cherry date elderberry fig grape';
    const result = await execute(mockContext, { text, maxTags: 3 });

    expect(result.tags.length).toBeLessThanOrEqual(3);
  });

  it('should handle empty text', async () => {
    const result = await execute(mockContext, { text: '' });

    expect(result.tags).toEqual([]);
    expect(result.counts).toEqual({});
  });
});
