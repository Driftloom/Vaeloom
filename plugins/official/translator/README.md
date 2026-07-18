# @vaeloom/plugin-translator

Translation plugin for Vaeloom.

Returns a structured translation request that the agent engine can pass to an AI service.

## Usage

```typescript
import { execute } from '@vaeloom/plugin-translator';

const result = await execute(context, {
  text: 'Hello world',
  targetLanguage: 'Spanish',
});
// { originalLanguage: 'detected', translation: 'requested translation for: Hello world', targetLanguage: 'Spanish', note: 'Use AI service for actual translation' }
```
