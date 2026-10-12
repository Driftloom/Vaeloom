module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }],
  },
  // Thresholds belong here, not in the root jest.config.ts. That file uses
  // `projects: ['<rootDir>/apps/*', '<rootDir>/packages/*']`, and Jest applies
  // coverage settings per project -- a root coverageThreshold is never
  // consulted. The root still declared 70/75/80/80, which read like an
  // enforced gate and enforced nothing.
  //
  // Baseline measured on this package: 92.03 statements, 67.78 branches,
  // 63.78 functions, 91.34 lines. Floors sit a little below so an unrelated
  // file cannot redden the build, but branches and functions are held well
  // under the aspirational 70/75 that the root config claimed -- that gap is
  // real and should be closed by tests, not by lowering the bar again.
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 65,
      functions: 60,
      lines: 88,
    },
  },
};
