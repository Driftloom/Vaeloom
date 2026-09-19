# `@vaeloom/eslint-config`

Shared ESLint configuration presets for Vaeloom workspace packages and applications.

## Configurations

- `@vaeloom/eslint-config/base`: Core TypeScript and JavaScript linting rules.
- `@vaeloom/eslint-config/nextjs`: Next.js 15 and React linting rules, including hooks and JSX accessibility.

## Usage

In package `.eslintrc.js` or `.eslintrc.json`:

```json
{
  "extends": ["@vaeloom/eslint-config/nextjs"]
}
```
