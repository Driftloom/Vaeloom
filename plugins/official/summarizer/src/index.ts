import type { PluginManifest, PluginContext } from '@vaeloom/plugin-sdk';

export const manifest: PluginManifest = {
  id: '00000000-0000-0000-0000-000000000001' as const,
  name: 'summarizer',
  version: '1.0.0',
  description: 'Extractive text summarization using frequency-based sentence scoring',
  author: 'vaeloom',
  license: 'MIT',
  tags: ['text', 'summarization', 'nlp'],
  minAppVersion: '0.1.0',
  permissions: {
    memory: ['read'],
    agents: [],
    events: [],
    storage: [],
    network: [],
    files: [],
  },
  capabilities: ['memory:read'],
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
  'just', 'also', 'very', 'too', 'really', 'already',
]);

const SENTENCE_END = /[.!?]+/g;

export async function execute(
  _context: PluginContext,
  input: { text: string; maxLength?: number },
): Promise<{ summary: string; originalLength: number; summaryLength: number }> {
  const sentences = splitSentences(input.text);
  const maxLen = input.maxLength ?? Math.max(1, Math.floor(sentences.length * 0.3));

  if (sentences.length <= maxLen) {
    return {
      summary: input.text,
      originalLength: input.text.length,
      summaryLength: input.text.length,
    };
  }

  const wordFreq = computeWordFrequencies(sentences);
  const scored = sentences.map((sentence) => ({
    sentence,
    score: scoreSentence(sentence, wordFreq),
  }));

  scored.sort((a, b) => b.score - a.score);
  const topSentences = scored.slice(0, maxLen);
  topSentences.sort((a, b) => sentences.indexOf(a.sentence) - sentences.indexOf(b.sentence));

  const summary = topSentences.map((s) => s.sentence).join(' ');

  return {
    summary,
    originalLength: input.text.length,
    summaryLength: summary.length,
  };
}

function splitSentences(text: string): string[] {
  const raw = text.split(SENTENCE_END).filter((s) => s.trim().length > 0);
  return raw.map((s) => s.trim() + '.');
}

function computeWordFrequencies(sentences: string[]): Map<string, number> {
  const freq = new Map<string, number>();

  for (const sentence of sentences) {
    const words = sentence.toLowerCase().match(/\b[a-z]+\b/g) ?? [];
    for (const word of words) {
      if (STOP_WORDS.has(word) || word.length < 2) continue;
      freq.set(word, (freq.get(word) ?? 0) + 1);
    }
  }

  return freq;
}

function scoreSentence(sentence: string, wordFreq: Map<string, number>): number {
  const words = sentence.toLowerCase().match(/\b[a-z]+\b/g) ?? [];
  if (words.length === 0) return 0;

  let score = 0;
  for (const word of words) {
    if (!STOP_WORDS.has(word) && word.length >= 2) {
      score += wordFreq.get(word) ?? 0;
    }
  }

  return score / words.length;
}
