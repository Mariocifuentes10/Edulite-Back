/**
 * scripts/e2e-setup.js
 * globalSetup de Jest (config e2e): levanta un PostgreSQL embebido en el
 * puerto 55434 con base de datos FRESCA, aplica db/schema.sql y db/seed.sql,
 * y expone la variable DATABASE_URL para los tests.
 */
const fs = require('fs');
const path = require('path');
const EmbeddedPostgres = require('embedded-postgres').default;

// Entorno de pruebas: desactiva los rate-limiters (ver rate-limit.middleware.js).
// Se fija aquí porque los workers heredan process.env del proceso main de Jest.
process.env.NODE_ENV = 'test';

const PUERTO = 55434;
const BASE = 'edulite_pruebas';
const DIR_DATOS = path.join(__dirname, '..', 'db', '.datos-pruebas');

module.exports = async function configurarPruebas() {
  // Base nueva en cada corrida: resultados deterministas.
  if (fs.existsSync(DIR_DATOS)) {
    try {
      fs.rmSync(DIR_DATOS, { recursive: true, force: true });
    } catch (error) {
      throw new Error(
        `No se pudo limpiar ${DIR_DATOS}. ¿Quedó un postgres de una corrida anterior corriendo? ` +
          `Detalle: ${error.message}`
      );
    }
  }

  const pg = new EmbeddedPostgres({
    databaseDir: DIR_DATOS,
    port: PUERTO,
    user: 'postgres',
    password: 'edulite',
    persistent: true,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: () => {},
    onError: (mensaje) => console.error('[postgres e2e]', mensaje),
  });

  await pg.initialise();
  await pg.start();
  await pg.createDatabase(BASE);

  const cliente = pg.getPgClient(BASE);
  await cliente.connect();
  await cliente.query(
    fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8')
  );
  await cliente.query(
    fs.readFileSync(path.join(__dirname, '..', 'db', 'seed.sql'), 'utf8')
  );
  await cliente.end();

  // Los workers heredan process.env del proceso principal de Jest.
  process.env.DATABASE_URL = `postgresql://postgres:edulite@localhost:${PUERTO}/${BASE}`;

  // Lo usa scripts/e2e-teardown.js para apagar el cluster.
  global.__PG_E2E__ = pg;

  console.log(`✅ PostgreSQL de pruebas listo (puerto ${PUERTO}, base ${BASE})`);
};
