module.exports = {
  extends: ['@vaeloom/eslint-config/base'],
  // Generated Prisma client is not linted.
  ignorePatterns: ['dist', 'coverage', 'node_modules', 'src/generated'],
  rules: {
    // NestJS relies on runtime value imports for constructor-based DI
    // (emitDecoratorMetadata). Forcing `import type` on injected providers
    // would elide those references and break dependency injection.
    '@typescript-eslint/consistent-type-imports': 'off',
  },
};
