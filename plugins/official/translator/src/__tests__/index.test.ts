import { execute } from '../index';
import type { PluginContext } from '@vaeloom/plugin-sdk';

const mockContext: PluginContext = {
  pluginId: '00000000-0000-0000-0000-000000000002' as const,
  tenantId: '00000000-0000-0000-0000-000000000001' as const,
  userId: '00000000-0000-0000-0000-000000000001' as const,
  config: {
    enabled: true,
    settings: {},
    permissions: { memory: [], agents: [], events: [], storage: [], network: ['outbound'], files: [] },
  },
  api: {} as never,
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  storage: {} as never,
};

describe('translator', () => {
  it('should return translation request details', async () => {
    const result = await execute(mockContext, {
      text: 'Hello world',
      targetLanguage: 'Spanish',
    });

    expect(result.originalLanguage).toBe('detected');
    expect(result.translation).toBe('requested translation for: Hello world');
    expect(result.targetLanguage).toBe('Spanish');
    expect(result.note).toBe('Use AI service for actual translation');
  });
});
