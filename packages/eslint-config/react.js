// Extra React rules for packages that ship components but don't use Next.js.
//
// Spread after the base preset:
//
//   const base = require('@vaeloom/eslint-config/base');
//   const react = require('@vaeloom/eslint-config/react');
//   module.exports = [...base, ...react];
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const prettier = require('eslint-config-prettier');

module.exports = [
  react.configs.flat.recommended,
  {
    name: '@vaeloom/react/hooks',
    plugins: {
      'react-hooks': reactHooks,
    },
    // Keep the pre-ESLint-10 contract. eslint-plugin-react-hooks 7 also ships
    // the React Compiler rules; those are deferred to a dedicated compiler
    // readiness pass rather than enabled by this dependency-upgrade change.
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    name: '@vaeloom/react/rules',
    settings: {
      react: {
        // Pin the version instead of `detect`: eslint-plugin-react 7.37 uses
        // context.getFilename() during detection, which ESLint 10 removed.
        // Keep in sync with the react override in the root package.json.
        version: '19.3.1',
      },
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
  },
  prettier,
];
