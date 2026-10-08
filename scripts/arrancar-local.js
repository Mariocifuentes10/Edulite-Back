/**
 * scripts/arrancar-local.js
 * Arranca un PostgreSQL EMBEBIDO (devDependency `embedded-postgres`), crea la
 * base `edulite`, carga db/schema.sql + db/seed.sql y levanta la API.
 *
 * Uso:  npm run local     (Ctrl+C detiene API y base de datos)
 *
 * Para qué sirve: desarrollo y demo en máquinas SIN PostgreSQL ni Docker.
 * En un entorno con PostgreSQL propio NO se usa este script: se apunta
 * DATABASE_URL en . .env y se corre `npm run dev`.
 */
const fs = require('fs');
const path = require('path');
const EmbeddedPostgres = require('embedded-postgres').default;

const PUERTO = 55432;
const USUARIO = 'postgres';
const CLAVE = 'edulite';
const BASE = 'edulite';
const DIR_DATOS = path.join(__dirname, '..', 'db', '.datos-locales');

// Debe establecerse ANTES de requerir config/env.js (dotenv no pisa vars ya definidas).
const DATABASE_URL = `postgresql://${USUARIO}:${CLAVE}@localhost:${PUERTO}/${BASE}`;
process.env.DATABASE_URL = DATABASE_URL;

const sql = (archivo) =>
  fs.readFileSync(path.join(__dirname, '..', 'db', archivo), 'utf8');

async function main() {
  const pg = new EmbeddedPostgres({
    databaseDir: DIR_DATOS,
    port: PUERTO,
    user: USUARIO,
    password: CLAVE,
    persistent: true, // conserva los datos entre arranques
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: () => {},
    onError: (e) => console.error('[postgres]', e),
  });

  // Inicializar el cluster solo si todavía no existe.
  const yaInicializada = fs.existsSync(path.join(DIR_DATOS, 'PG_VERSION'));
  if (!yaInicializada) {
    console.log('⏳ Inicializando PostgreSQL embebido (primera vez)...');
    await pg.initialise();
  }

  await pg.start();
  console.log(`✅ PostgreSQL embebido corriendo en el puerto ${PUERTO}`);

  // Crear la base si no existe (42P04 = ya existe).
  try {
    await pg.createDatabase(BASE);
    console.log(`✅ Base "${BASE}" creada`);
  } catch (error) {
    if (!String(error).includes('42P04')) throw error;
    console.log(`ℹ️  Base "${BASE}" ya existía`);
  }

  const cliente = pg.getPgClient(BASE);
  await cliente.connect();

  // Cargar schema solo si la tabla usuarios no existe (evita duplicar tipos ENUM).
  const existeSchema = await cliente.query(
    `SELECT to_regclass('public.usuarios') AS tabla`
  );
  if (existeSchema.rows[0].tabla) {
    console.log('ℹ️  schema.sql ya estaba aplicado; se omite');
  } else {
    console.log('⏳ Aplicando db/schema.sql ...');
    await cliente.query(sql('schema.sql'));
    console.log('✅ schema.sql aplicado');
  }

  console.log('⏳ Aplicando db/seed.sql ...');
  await cliente.query(sql('seed.sql'));
  console.log('✅ seed.sql aplicado (usuarios demo)');

  await cliente.end();

  // Configurar el entorno y arrancar la API en el mismo proceso.
  process.env.DATABASE_URL = DATABASE_URL;
  const env = require('../config/env');
  const { pool } = require('../config/db');
  const app = require('../app');

  const servidor = app.listen(env.PORT, () => {
    console.log('');
    console.log('🚀 EduLite API (modo local) en http://localhost:' + env.PORT);
    console.log('📖 Swagger: http://localhost:' + env.PORT + '/api/docs');
    console.log('👤 Login demo: estudiante@edulite.test / EduLite123!');
    console.log('   Ctrl+C para detener API y base de datos.');
  });

  const cerrar = async () => {
    console.log('\nDeteniendo...');
    servidor.close();
    try {
      await pool.end();
      await pg.stop();
    } catch {}
    process.exit(0);
  };
  process.on('SIGINT', cerrar);
  process.on('SIGTERM', cerrar);
}

main().catch((error) => {
  console.error('❌ No se pudo iniciar el entorno local:', error);
  process.exit(1);
});
