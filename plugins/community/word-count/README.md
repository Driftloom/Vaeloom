# @vaeloom/plugin-wordcount

Word, character, sentence, paragraph, and reading time analysis plugin.

## Usage

```typescript
import { execute } from '@vaeloom/plugin-wordcount';

const result = await execute(context, { text: 'Hello world. This is a test.' });
// { wordCount: 6, charCount: 27, sentenceCount: 2, paragraphCount: 1, avgWordLength: 3.8, readingTimeMinutes: 0.03 }
```
