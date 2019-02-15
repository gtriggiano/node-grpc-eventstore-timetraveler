module.exports = {
  collectCoverage: true,
  collectCoverageFrom: ['dist/main/**/*', '!dist/main/proto/**'],
  coverageReporters: ['json', 'lcov', 'text', 'clover'],
  coverageDirectory: '<rootDir>/pages/coverage',
  moduleNameMapper: {
    '^lib$': '<rootDir>/dist/main',
    '^lib(.*)?$': '<rootDir>/dist/main$1',
  },
  // coverageThreshold: {
  //   global: {
  //     lines: 100,
  //     statements: 100,
  //     functions: 100,
  //     branches: 100,
  //   },
  // },
  reporters: ['default', 'jest-stare'],
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/?(*.)+(spec|test).js'],
  testResultsProcessor: './jest.processor.js',
  transformIgnorePatterns: ['/node_modules/', '<rootDir>/dist/'],
  // moduleFileExtensions: ['ts', 'js'],
  // transform: {
  //   '^.+\\.(js)$': 'babel-jest',
  //   '^.+\\.(ts)$': 'ts-jest',
  // },
}
