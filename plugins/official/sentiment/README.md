# @vaeloom/plugin-sentiment

Lexicon-based sentiment analysis plugin.

Uses built-in positive/negative word lists to score text sentiment.

## Usage

```typescript
import { execute } from '@vaeloom/plugin-sentiment';

const result = await execute(context, { text: 'I love this amazing product!' });
// { score: 0.67, label: 'positive', confidence: 0.8, details: { positiveWords: ['love', 'amazing'], negativeWords: [] } }
```
