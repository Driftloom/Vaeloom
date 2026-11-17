// Rule layer for Next.js apps.
//
// `eslint-config-next` is a direct devDependency of the app, not of this
// package, so the app composes its Next preset itself and then spreads this
// layer on top:
//
//   const next = require('eslint-config-next/core-web-vitals');
//   const nextjs = require('@vaeloom/eslint-config/nextjs');
//   module.exports = [...next, ...nextjs, { ignores: ['.next/**'] }];
//
// Keeping the Next import in the app avoids registering the same plugins twice
// from two physical paths, which flat config rejects as a plugin conflict.
const prettier = require('eslint-config-prettier');

// eslint-config-next 16 enables the React Compiler rule set from
// eslint-plugin-react-hooks 7. Those rules assume a compiler-readiness pass
// (memoization preservation, ref access, effect purity) that this codebase has
// not done yet, and they fire on long-standing patterns. Keep the pre-upgrade
// contract: rules-of-hooks and exhaustive-deps stay enabled, compiler rules are
// deferred to a dedicated React Compiler migration.
const reactCompilerRules = {
  'react-hooks/static-components': 'off',
  'react-hooks/use-memo': 'off',
  'react-hooks/preserve-manual-memoization': 'off',
  'react-hooks/incompatible-library': 'off',
  'react-hooks/immutability': 'off',
  'react-hooks/globals': 'off',
  'react-hooks/refs': 'off',
  'react-hooks/set-state-in-effect': 'off',
  'react-hooks/error-boundaries': 'off',
  'react-hooks/purity': 'off',
  'react-hooks/set-state-in-render': 'off',
  'react-hooks/unsupported-syntax': 'off',
  'react-hooks/config': 'off',
  'react-hooks/gating': 'off',
};

module.exports = [
  {
    name: '@vaeloom/nextjs/rules',
    settings: {
      react: {
        // Pin the version instead of `detect`: eslint-plugin-react 7.37 uses
        // context.getFilename() during detection, which ESLint 10 removed.
        // Keep in sync with the react override in the root package.json.
        version: '19.3.1',
      },
    },
    rules: {
      ...reactCompilerRules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  prettier,
];
