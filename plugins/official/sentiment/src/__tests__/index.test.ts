import { execute } from '../index';
import type { PluginContext } from '@vaeloom/plugin-sdk';

const mockContext: PluginContext = {
  pluginId: '00000000-0000-0000-0000-000000000003' as const,
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

describe('sentiment', () => {
  it('should detect positive sentiment', async () => {
    const result = await execute(mockContext, {
      text: 'I love this amazing wonderful product!',
    });

    expect(result.label).toBe('positive');
    expect(result.score).toBeGreaterThan(0);
    expect(result.details.positiveWords.length).toBeGreaterThan(0);
  });

  it('should detect negative sentiment', async () => {
    const result = await execute(mockContext, {
      text: 'This is terrible, awful, and horrible.',
    });

    expect(result.label).toBe('negative');
    expect(result.score).toBeLessThan(0);
    expect(result.details.negativeWords.length).toBeGreaterThan(0);
  });

  it('should detect neutral sentiment for mixed input', async () => {
    const result = await execute(mockContext, {
      text: 'The table is made of wood.',
    });

    expect(result.label).toBe('neutral');
    expect(result.score).toBe(0);
  });

  it('should handle empty text', async () => {
    const result = await execute(mockContext, { text: '' });

    expect(result.label).toBe('neutral');
    expect(result.score).toBe(0);
    expect(result.confidence).toBe(0);
  });
});
