// Standalone Next.js ESLint config.
//
// `eslint-config-next` (via `next/core-web-vitals`) already registers the
// @typescript-eslint, import, react, react-hooks, and jsx-a11y plugins. In a
// pnpm workspace, also extending our shared `base.js` would register those same
// plugin names from a different physical path, which ESLint rejects with a
// "plugin conflicted between configs" error. So this config layers our shared
// rule preferences on top of Next's config instead of chaining through base.js.
module.exports = {
  root: true,
  extends: ['next/core-web-vitals', 'prettier'],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'prefer-const': 'error',
    'no-var': 'error',
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  ignorePatterns: ['dist', '.next', 'node_modules', 'coverage'],
};
