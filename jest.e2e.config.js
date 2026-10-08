/**
 * jest.e2e.config.js
 * Configuración para los tests end-to-end (supertest + PostgreSQL embebido).
 * Uso: npm run test:e2e
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/e2e/**/*.test.js'],
  globalSetup: '<rootDir>/scripts/e2e-setup.js',
  globalTeardown: '<rootDir>/scripts/e2e-teardown.js',
  // initdb + bcrypt pueden tardar en la primera prueba.
  testTimeout: 60000,
  // Una sola ejecución a la vez: todos los tests comparten la misma base.
  maxWorkers: 1,
  clearMocks: true,
};
