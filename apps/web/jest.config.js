const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/e2e/'],
  // The default 5s budget assumes an idle machine. These suites mount the whole
  // capability workbench (SWR, tool registry, MCP client) and do real awaits; with
  // parallel workers on a loaded box they took 48-105s per suite, so any single
  // 5s-capped test failed on scheduling jitter rather than on behaviour. Measured
  // serial time for the two slowest suites is ~14s and ~48s, so 30s leaves headroom
  // without turning a genuine hang into a 30-minute wait.
  testTimeout: 30000,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Same reasoning as packages/ui-kit: with `projects` in the root config,
  // Jest applies coverage thresholds per project, so a root-level
  // coverageThreshold is never read. This is where the gate has to live.
  //
  // Baseline measured on this package: 55.92 statements, 52.23 branches,
  // 50.70 functions, 56.93 lines. The root config claimed 80/70/75/80, which
  // this app has never met -- it was never enforced, so nobody noticed.
  //
  // These floors are low and that is worth saying plainly rather than hiding:
  // a majority of statement coverage across an app this size is a real gap.
  // The gate now makes the number visible and stops it falling; raising it is
  // follow-up work, and every one of these four should only ever go up.
  coverageThreshold: {
    global: {
      statements: 53,
      branches: 49,
      functions: 47,
      lines: 54,
    },
  },
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);
