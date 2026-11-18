const next = require('eslint-config-next/core-web-vitals');

const nextjs = require('@vaeloom/eslint-config/nextjs');

module.exports = [
  ...next,
  ...nextjs,
  {
    ignores: [
      '.next/**',
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
];
