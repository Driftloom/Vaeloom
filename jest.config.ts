import type { Config } from 'jest';

const config: Config = {
  projects: ['<rootDir>/apps/*', '<rootDir>/packages/*'],
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: ['**/*.(t|j)s', '!**/*.d.ts', '!**/node_modules/**', '!**/dist/**'],
  coverageReporters: ['lcov', 'text', 'clover'],
  // No coverageThreshold here on purpose.
  //
  // This config declares `projects`, and Jest resolves coverage settings per
  // project: each child config owns its own collectCoverageFrom and
  // coverageThreshold. A global threshold on a projects-based root config is
  // silently ignored. That file previously declared 70/75/80/80 here, which
  // looked like an enforced gate and enforced nothing -- and neither project
  // was anywhere near it.
  //
  // The real thresholds now live in each project:
  //   packages/ui-kit/jest.config.js  90/65/60/88  (statements/branches/functions/lines)
  //   apps/web/jest.config.js         53/49/47/54
  //
  // Measured the same session those baselines were written.
};

export default config;
