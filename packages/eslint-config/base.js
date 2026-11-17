// Shared flat config for workspace packages.
//
// ESLint 10 removed eslintrc support, so this package exports native flat
// config arrays. Consumers create an `eslint.config.js` that spreads the
// preset they need:
//
//   const base = require('@vaeloom/eslint-config/base');
//   module.exports = [...base, { ignores: ['dist/**'] }];
const js = require('@eslint/js');
const globals = require('globals');
const tseslint = require('typescript-eslint');
// eslint-plugin-import 2.32.0 (latest) still calls SourceCode methods that
// ESLint 10 removed (`getTokenOrCommentBefore`), which crashes import/order.
// eslint-plugin-import-x is the maintained fork with the same rule set and
// explicit ESLint 10 support. Register it under the `import` namespace so rule
// IDs stay `import/*` and existing configs keep working.
const importPlugin = require('eslint-plugin-import-x');
const prettier = require('eslint-config-prettier');

module.exports = [
  {
    name: '@vaeloom/base/language-options',
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        // Equivalent to the old `env: { es2022: true }` (ES2022 added no new
        // globals over ES2021, which is what ESLint's es2022 env exposed).
        ...globals.es2021,
      },
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    name: '@vaeloom/base/rules',
    plugins: {
      import: importPlugin,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      'import/order': [
        'warn',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc' },
        },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  prettier,
];
