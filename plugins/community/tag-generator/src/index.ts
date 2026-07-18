import type { PluginManifest, PluginContext } from '@vaeloom/plugin-sdk';

export const manifest: PluginManifest = {
  id: '00000000-0000-0000-0000-000000000005' as const,
  name: 'tag-generator',
  version: '1.0.0',
  description: 'Extract keywords from text using term frequency analysis with stop word filtering',
  author: 'community',
  license: 'MIT',
  tags: ['keywords', 'tags', 'nlp', 'text-analysis'],
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

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
  'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'not',
  'no', 'nor', 'so', 'if', 'than', 'that', 'this', 'these', 'those',
  'it', 'its', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he',
  'him', 'his', 'she', 'her', 'they', 'them', 'their', 'what',
  'which', 'who', 'whom', 'when', 'where', 'why', 'how', 'all',
  'each', 'every', 'both', 'few', 'more', 'most', 'some', 'any',
  'about', 'into', 'over', 'after', 'before', 'between', 'under',
  'just', 'also', 'very', 'too', 'really', 'already', 'up', 'down',
  'out', 'off', 'above', 'below', 'am', 'being', 'having', 'doing',
  'get', 'got', 'getting', 'make', 'made', 'making', 'go', 'goes',
  'went', 'going', 'come', 'came', 'coming', 'take', 'took', 'taking',
  'know', 'known', 'knowing', 'think', 'thinks', 'thought', 'thinking',
  'see', 'saw', 'seen', 'seeing', 'want', 'wanted', 'wanting', 'give',
  'gave', 'given', 'giving', 'use', 'used', 'using', 'find', 'found',
  'finding', 'tell', 'told', 'telling', 'ask', 'asked', 'asking',
]);

export async function execute(
  _context: PluginContext,
  input: { text: string; maxTags?: number },
): Promise<{ tags: string[]; counts: Record<string, number> }> {
  const maxTags = input.maxTags ?? 10;
  const words = input.text.toLowerCase().match(/\b[a-z]+(?:'[a-z]+)?\b/g) ?? [];

  const freq = new Map<string, number>();

  for (const word of words) {
    if (STOP_WORDS.has(word) || word.length < 3) continue;
    freq.set(word, (freq.get(word) ?? 0) + 1);
  }

  const sorted = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxTags);

  const tags = sorted.map(([word]) => word);
  const counts: Record<string, number> = {};
  for (const [word, count] of sorted) {
    counts[word] = count;
  }

  return { tags, counts };
}
