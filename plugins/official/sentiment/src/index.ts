import type { PluginManifest, PluginContext } from '@vaeloom/plugin-sdk';

export const manifest: PluginManifest = {
  id: '00000000-0000-0000-0000-000000000003' as const,
  name: 'sentiment',
  version: '1.0.0',
  description: 'Lexicon-based sentiment analysis using positive/negative word matching',
  author: 'vaeloom',
  license: 'MIT',
  tags: ['sentiment', 'analysis', 'nlp'],
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

const POSITIVE_WORDS = new Set([
  'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'beautiful',
  'love', 'happy', 'joy', 'delight', 'pleased', 'splendid', 'superb', 'brilliant',
  'outstanding', 'remarkable', 'positive', 'favorable', 'beneficial', 'helpful',
  'kind', 'nice', 'best', 'perfect', 'awesome', 'incredible', 'terrific', 'glad',
  'thankful', 'grateful', 'success', 'successful', 'impressive', 'enjoy',
  'enjoyable', 'fun', 'exciting', 'thrilled', 'friendly', 'warm', 'caring',
  'supportive', 'generous', 'honest', 'loyal', 'bright', 'smart', 'clever',
  'elegant', 'charming', 'graceful', 'vibrant', 'cheerful', 'optimistic',
  'peaceful', 'calm', 'comfortable', 'cozy', 'refreshing', 'invigorating',
]);

const NEGATIVE_WORDS = new Set([
  'bad', 'terrible', 'awful', 'horrible', 'dreadful', 'poor', 'hate', 'angry',
  'sad', 'upset', 'depressed', 'miserable', 'gloomy', 'disappointed', 'frustrated',
  'annoying', 'irritating', 'ugly', 'nasty', 'cruel', 'evil', 'wicked', 'horrid',
  'disgusting', 'repulsive', 'offensive', 'harmful', 'damaging', 'destructive',
  'negative', 'unfavorable', 'hurtful', 'painful', 'suffering', 'grief', 'sorrow',
  'regret', 'shameful', 'worst', 'failure', 'failed', 'lose', 'lost', 'ugly',
  'selfish', 'lazy', 'stupid', 'dull', 'boring', 'tired', 'weak', 'broken',
  'corrupt', 'dangerous', 'fear', 'scared', 'anxious', 'worry', 'stress',
  'difficult', 'hard', 'tough', 'crisis', 'problem', 'issue', 'complaint',
]);

export async function execute(
  _context: PluginContext,
  input: { text: string },
): Promise<{
  score: number;
  label: 'positive' | 'negative' | 'neutral';
  confidence: number;
  details: { positiveWords: string[]; negativeWords: string[] };
}> {
  const words = input.text.toLowerCase().match(/\b[a-z']+\b/g) ?? [];
  const totalWords = words.length;

  if (totalWords === 0) {
    return {
      score: 0,
      label: 'neutral',
      confidence: 0,
      details: { positiveWords: [], negativeWords: [] },
    };
  }

  const positiveWords: string[] = [];
  const negativeWords: string[] = [];

  for (const word of words) {
    if (POSITIVE_WORDS.has(word)) positiveWords.push(word);
    if (NEGATIVE_WORDS.has(word)) negativeWords.push(word);
  }

  const positiveCount = positiveWords.length;
  const negativeCount = negativeWords.length;
  const score = (positiveCount - negativeCount) / totalWords;

  let label: 'positive' | 'negative' | 'neutral';
  if (score > 0.05) label = 'positive';
  else if (score < -0.05) label = 'negative';
  else label = 'neutral';

  const totalSentimentWords = positiveCount + negativeCount;
  const confidence = totalWords > 0 ? totalSentimentWords / totalWords : 0;

  return {
    score: Math.max(-1, Math.min(1, score)),
    label,
    confidence: Math.min(1, confidence),
    details: { positiveWords, negativeWords },
  };
}
