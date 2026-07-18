# @vaeloom/plugin-taggenerator

Tag/keyword generator using term frequency extraction.

Filters out common stop words and returns the top N most frequent terms.

## Usage

```typescript
import { execute } from '@vaeloom/plugin-taggenerator';

const result = await execute(context, {
  text: 'Machine learning and artificial intelligence are transforming technology...',
  maxTags: 5,
});
// { tags: ['machine', 'learning', 'artificial', 'intelligence', 'transforming'], counts: { machine: 3, learning: 2, ... } }
```
