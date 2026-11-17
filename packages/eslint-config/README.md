# `@vaeloom/eslint-config`

Shared ESLint flat-config presets for Vaeloom workspace packages and
applications. Requires ESLint 10; eslintrc (`.eslintrc.*`) is not supported.

## Presets

- `@vaeloom/eslint-config/base`: core TypeScript and JavaScript rules for
  workspace packages.
- `@vaeloom/eslint-config/nextjs`: rule layer for Next.js apps. Compose it with
  the app's own `eslint-config-next` preset.
- `@vaeloom/eslint-config/react`: React and hooks rules for packages that ship
  components without Next.js.

## Usage

Each package keeps an `eslint.config.js` at its root. ESLint resolves the
config from the directory it runs in, so the file stays per project and the
workspace has no implicit root config.

Package preset:

```js
const base = require('@vaeloom/eslint-config/base');

module.exports = [...base, { ignores: ['dist/**', 'coverage/**'] }];
```

Next.js app:

```js
const next = require('eslint-config-next/core-web-vitals');
const nextjs = require('@vaeloom/eslint-config/nextjs');

module.exports = [
  ...next,
  ...nextjs,
  { ignores: ['.next/**', 'dist/**', 'coverage/**'] },
];
```

React package:

```js
const base = require('@vaeloom/eslint-config/base');
const react = require('@vaeloom/eslint-config/react');

module.exports = [...base, ...react, { ignores: ['dist/**', 'coverage/**'] }];
```

Global ignore patterns are resolved relative to the project's
`eslint.config.js`, so each project lists its own build output.
