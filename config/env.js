/**
 * config/env.js
 * Carga y valida las variables de entorno al arrancar.
 * Si falta algo, acumula TODOS los errores y termina el proceso con un mensaje claro.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const errores = [];

function requerida(nombre) {
  const valor = process.env[nombre];
  if (!valor || valor.trim() === '') {
    errores.push(`Falta la variable obligatoria: ${nombre}`);
    return '';
  }
  return valor.trim();
}

const NODE_ENV = process.env.NODE_ENV || 'development';

const PORT = (() => {
  const crudo = process.env.PORT || '3000';
  const numero = Number(crudo);
  if (!Number.isInteger(numero) || numero <= 0 || numero > 65535) {
    errores.push(`PORT debe ser un número entero válido (recibido: "${crudo}")`);
    return 3000;
  }
  return numero;
})();

const DATABASE_URL = requerida('DATABASE_URL');

const JWT_SECRET = requerida('JWT_SECRET');
if (JWT_SECRET && JWT_SECRET.length < 32) {
  errores.push(
    `JWT_SECRET debe tener al menos 32 caracteres (tiene ${JWT_SECRET.length}). ` +
      `Genere uno con: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
  );
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
if (!/^\d+[smhd]$/.test(JWT_EXPIRES_IN)) {
  errores.push(
    `JWT_EXPIRES_IN debe tener formato número + unidad (ej: 30m, 12h, 7d). Recibido: "${JWT_EXPIRES_IN}"`
  );
}

const BCRYPT_ROUNDS = (() => {
  const crudo = process.env.BCRYPT_ROUNDS || '10';
  const numero = Number(crudo);
  if (!Number.isInteger(numero) || numero < 10) {
    errores.push(`BCRYPT_ROUNDS debe ser un entero >= 10 (recibido: "${crudo}")`);
    return 10;
  }
  return numero;
})();

const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:4200';

if (errores.length > 0) {
  console.error('\n❌ La aplicación no puede iniciar. Corrija las siguientes variables en .env:\n');
  errores.forEach((e) => console.error(`   • ${e}`));
  console.error('\nConsulte .env.example para ver las variables requeridas.\n');
  process.exit(1);
}

/** Configuración congelada: no debe mutarse en tiempo de ejecución. */
module.exports = Object.freeze({
  NODE_ENV,
  ES_PRODUCCION: NODE_ENV === 'production',
  PORT,
  CORS_ORIGIN,
  DATABASE_URL,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  BCRYPT_ROUNDS,
});
