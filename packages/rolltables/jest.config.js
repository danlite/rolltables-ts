module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testPathIgnorePatterns: [
    '/__mocks__/',
    '/mocks/',
    '/dist/',
    'mocks.ts',
    'operations.ts',
  ],
  coveragePathIgnorePatterns: ['/dist/', 'types/index.d.ts'],
  collectCoverage: false,
  coverageDirectory: '<rootDir>/.coverage',
  coverageReporters: ['html', 'json', 'lcov', 'text'],
  clearMocks: true,
  // coverageThreshold: {
  //   global: {
  //     branches: 45,
  //     functions: 60,
  //     lines: 65,
  //     statements: 65,
  //   },
  // },
  reporters: ['default'],
}
