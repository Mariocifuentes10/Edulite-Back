/**
 * scripts/e2e-teardown.js
 * globalTeardown de Jest (config e2e): detiene el PostgreSQL embebido
 * que arrancó scripts/e2e-setup.js.
 */
module.exports = async function detenerPruebas() {
  if (global.__PG_E2E__) {
    await global.__PG_E2E__.stop();
    global.__PG_E2E__ = undefined;
    console.log('✅ PostgreSQL de pruebas detenido');
  }
};
