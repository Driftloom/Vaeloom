import type { Config } from 'jest';

const config: Config = {
  projects: ['<rootDir>/apps/*', '<rootDir>/packages/*', '<rootDir>/services/*'],
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: ['**/*.(t|j)s', '!**/*.d.ts', '!**/node_modules/**', '!**/dist/**'],
  coverageReporters: ['lcov', 'text', 'clover'],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 75,
      statements: 75,
    },
  },
};

export default config;
