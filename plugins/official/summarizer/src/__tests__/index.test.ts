import { execute } from '../index';
import type { PluginContext } from '@vaeloom/plugin-sdk';

const mockContext: PluginContext = {
  pluginId: '00000000-0000-0000-0000-000000000001' as const,
  tenantId: '00000000-0000-0000-0000-000000000001' as const,
  userId: '00000000-0000-0000-0000-000000000001' as const,
  config: {
    enabled: true,
    settings: {},
    permissions: { memory: ['read'], agents: [], events: [], storage: [], network: [], files: [] },
  },
  api: {} as never,
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  storage: {} as never,
};

describe('summarizer', () => {
  it('should summarize text extractively', async () => {
    const text = [
      'The quick brown fox jumps over the lazy dog.',
      'This is a test sentence about foxes and dogs.',
      'Foxes are known for their agility and cleverness.',
      'Dogs are loyal companions to humans worldwide.',
      'The quick brown fox is a popular pangram example.',
    ].join(' ');

    const result = await execute(mockContext, { text, maxLength: 2 });

    expect(result.summary).toBeTruthy();
    expect(result.originalLength).toBe(text.length);
    expect(result.summaryLength).toBeLessThan(text.length);
    expect(result.summary).toContain('.');
  });

  it('should return full text when shorter than maxLength', async () => {
    const result = await execute(mockContext, { text: 'Short text.', maxLength: 5 });

    expect(result.summary).toBe('Short text.');
    expect(result.summaryLength).toBe(result.originalLength);
  });

  it('should handle empty text', async () => {
    const result = await execute(mockContext, { text: '' });

    expect(result.summary).toBe('');
    expect(result.originalLength).toBe(0);
  });
});
