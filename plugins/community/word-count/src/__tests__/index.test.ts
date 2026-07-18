import { execute } from '../index';
import type { PluginContext } from '@vaeloom/plugin-sdk';

const mockContext: PluginContext = {
  pluginId: '00000000-0000-0000-0000-000000000004' as const,
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

describe('word-count', () => {
  it('should count words, chars, sentences, paragraphs', async () => {
    const result = await execute(mockContext, {
      text: 'Hello world. This is a test. How are you?',
    });

    expect(result.wordCount).toBe(9);
    expect(result.charCount).toBe(41);
    expect(result.sentenceCount).toBe(3);
    expect(result.paragraphCount).toBe(1);
    expect(result.avgWordLength).toBeGreaterThan(0);
    expect(result.readingTimeMinutes).toBeGreaterThan(0);
  });

  it('should handle empty text', async () => {
    const result = await execute(mockContext, { text: '' });

    expect(result.wordCount).toBe(0);
    expect(result.charCount).toBe(0);
    expect(result.sentenceCount).toBe(0);
    expect(result.readingTimeMinutes).toBe(0);
  });

  it('should detect multiple paragraphs', async () => {
    const result = await execute(mockContext, {
      text: 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.',
    });

    expect(result.paragraphCount).toBe(3);
  });
});
