/**
 * config/db.js
 * Pool de conexiones de PostgreSQL (driver pg, sin ORM).
 * Toda consulta debe usar parámetros ($1, $2, ...). Nunca concatenar strings.
 */
const { Pool } = require('pg');
const env = require('./env');

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  // Conexiones modestas: el proyecto prioriza bajo consumo de recursos.
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  // En los tests e2e el cluster se apaga al final: el reset de las
  // conexiones ociosas es esperado y solo ensuciaría la salida.
  if (env.NODE_ENV === 'test') return;
  console.error('Error inesperado en el pool de PostgreSQL:', err.message);
});

/**
 * Ejecuta una consulta parametrizada.
 * @param {string} sql - Consulta con $1, $2, ...
 * @param {Array} params - Parámetros de la consulta
 * @returns {Promise<import('pg').QueryResult>}
 */
function query(sql, params = []) {
  return pool.query(sql, params);
}

/** Cierra el pool (útil en tests y cierre ordenado). */
function cerrar() {
  return pool.end();
}

module.exports = { pool, query, cerrar };
