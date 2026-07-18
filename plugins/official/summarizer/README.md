# @vaeloom/plugin-summarizer

Extractive text summarization plugin using frequency-based sentence scoring.

## Algorithm

1. Split text into sentences
2. Tokenize words and count frequencies (excluding stop words)
3. Score each sentence by summing word frequencies
4. Select top N sentences by score

## Usage

```typescript
import { execute } from '@vaeloom/plugin-summarizer';

const result = await execute(context, {
  text: 'Long text to summarize...',
  maxLength: 3,
});
// { summary: '...', originalLength: 500, summaryLength: 120 }
```
