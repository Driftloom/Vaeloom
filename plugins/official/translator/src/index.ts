import type { PluginManifest, PluginContext } from '@vaeloom/plugin-sdk';

export const manifest: PluginManifest = {
  id: '00000000-0000-0000-0000-000000000002' as const,
  name: 'translator',
  version: '1.0.0',
  description: 'Translation plugin that prepares structured requests for AI service integration',
  author: 'vaeloom',
  license: 'MIT',
  tags: ['translation', 'language', 'i18n'],
  minAppVersion: '0.1.0',
  permissions: {
    memory: [],
    agents: [],
    events: [],
    storage: [],
    network: ['outbound'],
    files: [],
  },
  capabilities: ['network:http'],
  hooks: [],
};

export async function execute(
  _context: PluginContext,
  input: { text: string; targetLanguage: string },
): Promise<{
  originalLanguage: string;
  translation: string;
  targetLanguage: string;
  note: string;
}> {
  return {
    originalLanguage: 'detected',
    translation: `requested translation for: ${input.text}`,
    targetLanguage: input.targetLanguage,
    note: 'Use AI service for actual translation',
  };
}
