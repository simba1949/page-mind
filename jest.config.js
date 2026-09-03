module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts', '**/*.test.js'],
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', {
      diagnostics: false,
      tsconfig: {
        allowJs: true,
        module: 'CommonJS',
        outDir: './.jest-cache'
      }
    }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  // Source modules use explicit .js specifiers for Chrome MV3. Resolve those
  // specifiers back to TypeScript files only inside the Jest test runtime.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'clover'],
};
