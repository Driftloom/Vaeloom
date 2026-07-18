import type { PluginManifest, PluginContext } from '@vaeloom/plugin-sdk';

export const manifest: PluginManifest = {
  id: '00000000-0000-0000-0000-000000000004' as const,
  name: 'word-count',
  version: '1.0.0',
  description: 'Count words, characters, sentences, paragraphs with reading time estimation',
  author: 'community',
  license: 'MIT',
  tags: ['text', 'analysis', 'utility'],
  minAppVersion: '0.1.0',
  permissions: {
    memory: [],
    agents: [],
    events: [],
    storage: [],
    network: [],
    files: [],
  },
  capabilities: [],
  hooks: [],
};

const WORDS_PER_MINUTE = 200;

export async function execute(
  _context: PluginContext,
  input: { text: string },
): Promise<{
  wordCount: number;
  charCount: number;
  charCountNoSpaces: number;
  sentenceCount: number;
  paragraphCount: number;
  avgWordLength: number;
  readingTimeMinutes: number;
}> {
  const text = input.text;
  const charCount = text.length;
  const charCountNoSpaces = text.replace(/\s/g, '').length;
  const words = text.match(/\b\w+\b/g) ?? [];
  const wordCount = words.length;
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const sentenceCount = sentences.length;
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  const paragraphCount = Math.max(1, paragraphs.length);

  const totalCharLength = words.reduce((sum, w) => sum + w.length, 0);
  const avgWordLength = wordCount > 0 ? totalCharLength / wordCount : 0;
  const readingTimeMinutes = wordCount > 0 ? wordCount / WORDS_PER_MINUTE : 0;

  return {
    wordCount,
    charCount,
    charCountNoSpaces,
    sentenceCount,
    paragraphCount,
    avgWordLength: Math.round(avgWordLength * 10) / 10,
    readingTimeMinutes: Math.round(readingTimeMinutes * 100) / 100,
  };
}
