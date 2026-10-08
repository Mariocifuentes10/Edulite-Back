/**
 * server.js
 * Punto de entrada: valida el entorno, prueba la conexión a la base
 * de datos y levanta el servidor HTTP.
 */
const env = require('./config/env');
const { pool } = require('./config/db');
const app = require('./app');

async function iniciar() {
  try {
    // Verificar conexión con PostgreSQL antes de aceptar tráfico.
    await pool.query('SELECT 1');
    console.log('✅ Conexión a PostgreSQL establecida');
  } catch (error) {
    console.error('❌ No se pudo conectar a PostgreSQL:', error.message);
    console.error('   Revise DATABASE_URL en .env y que el servidor esté corriendo.');
    process.exit(1);
  }

  const servidor = app.listen(env.PORT, () => {
    console.log(`🚀 EduLite API escuchando en http://localhost:${env.PORT}`);
    console.log(`📖 Documentación Swagger: http://localhost:${env.PORT}/api/docs`);
    console.log(`🌐 Entorno: ${env.NODE_ENV} | CORS permitido: ${env.CORS_ORIGIN}`);
  });

  // Cierre ordenado: cierra el pool al recibir señales de terminación.
  const cerrar = async (senal) => {
    console.log(`\nRecibida ${senal}. Cerrando servidor...`);
    servidor.close(async () => {
      try {
        await pool.end();
        console.log('Pool de PostgreSQL cerrado. ¡Hasta luego!');
      } finally {
        process.exit(0);
      }
    });
    // Red de seguridad si algo se queda colgado.
    setTimeout(() => process.exit(1), 5000).unref();
  };

  process.on('SIGINT', () => cerrar('SIGINT'));
  process.on('SIGTERM', () => cerrar('SIGTERM'));
}

iniciar();
