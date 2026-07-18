import type { Config } from 'jest';

const config: Config = {
  projects: ['<rootDir>/apps/*', '<rootDir>/packages/*', '<rootDir>/services/*'],
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: ['**/*.(t|j)s', '!**/*.d.ts', '!**/node_modules/**', '!**/dist/**'],
  coverageReporters: ['lcov', 'text', 'clover'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80,
    },
  },
};

export default config;
