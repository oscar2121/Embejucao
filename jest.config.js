module.exports = {
  testEnvironment: 'node',
  setupFiles: ['./tests/setupEnv.js'],
  testTimeout: 15000,
  verbose: true,
  modulePathIgnorePatterns: [
    '<rootDir>/temp_zip/',
    '<rootDir>/tempapp/',
    '<rootDir>/_backup_archivos_residuales/',
    '<rootDir>/desktop-app/'
  ]
};
