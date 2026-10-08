/**
 * modulos/usuarios/usuarios.service.js
 * Acceso a datos de la tabla usuarios. El SQL vive aquí (regla del proyecto).
 * NUNCA se devuelve password_hash al cliente: todos los SELECT dirigidos al
 * cliente listan las columnas de forma explícita.
 */
const bcrypt = require('bcrypt');

const { query } = require('../../config/db');
const AppError = require('../../utils/app-error');
const env = require('../../config/env');

/** Columnas seguras para entregar al cliente (sin password_hash). */
const COLUMNAS_SEGURAS = 'id, nombre, email, rol, telefono, activo, creado_en';

/** Columnas mínimas para verificar credenciales en login (uso interno de auth). */
const COLUMNAS_LOGIN = 'id, nombre, email, rol, activo, password_hash';

/**
 * Crea un usuario con la contraseña ya hasheada (bcrypt).
 * Traduce la violación de unicidad de email (SQLSTATE 23505) en un AppError 409.
 *
 * @param {Object} datos
 * @param {string} datos.nombre
 * @param {string} datos.email
 * @param {string} datos.password - En texto plano; se hashea aquí.
 * @param {'ESTUDIANTE'|'TUTOR'|'ADMIN'} datos.rol
 * @param {string} [datos.telefono]
 * @returns {Promise<Object>} Usuario creado (columnas seguras)
 */
async function crear({ nombre, email, password, rol, telefono = null }) {
  const hash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);

  try {
    const { rows } = await query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, telefono)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${COLUMNAS_SEGURAS}`,
      [nombre, email, hash, rol, telefono]
    );
    return rows[0];
  } catch (error) {
    // Violación de unicidad sobre email -> conflicto.
    if (error.code === '23505') {
      throw new AppError('El email ya está registrado', 409);
    }
    throw error;
  }
}

/**
 * Busca un usuario por email (columnas seguras, sin hash).
 * @param {string} email
 * @returns {Promise<Object|null>}
 */
async function buscarPorEmail(email) {
  const { rows } = await query(
    `SELECT ${COLUMNAS_SEGURAS} FROM usuarios WHERE email = $1`,
    [email]
  );
  return rows[0] || null;
}

/**
 * Busca un usuario por id (columnas seguras, sin hash).
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
async function buscarPorId(id) {
  const { rows } = await query(
    `SELECT ${COLUMNAS_SEGURAS} FROM usuarios WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Busca un usuario por email INCLUYENDO password_hash.
 * SOLO lo usa auth.service para verificar credenciales; jamás debe
 * llegar este objeto a una respuesta JSON.
 *
 * @param {string} email
 * @returns {Promise<Object|null>}
 */
async function buscarParaLogin(email) {
  const { rows } = await query(
    `SELECT ${COLUMNAS_LOGIN} FROM usuarios WHERE email = $1`,
    [email]
  );
  return rows[0] || null;
}

/**
 * Lista usuarios paginados con filtro opcional por rol (panel de administración).
 * Nunca devuelve password_hash.
 *
 * @param {Object} [opciones]
 * @param {'ESTUDIANTE'|'TUTOR'|'ADMIN'|null} [opciones.rol] - null = todos
 * @param {number} [opciones.pagina=1]
 * @param {number} [opciones.limite=20]
 * @returns {Promise<{ usuarios: Object[], total: number }>}
 */
async function listar({ rol = null, pagina = 1, limite = 20 } = {}) {
  const offset = (pagina - 1) * limite;
  const { rows } = await query(
    `SELECT ${COLUMNAS_SEGURAS} FROM usuarios
     WHERE ($1::rol_usuario IS NULL OR rol = $1::rol_usuario)
     ORDER BY creado_en DESC, id DESC
     LIMIT $2 OFFSET $3`,
    [rol, limite, offset]
  );
  const { rows: conteo } = await query(
    `SELECT COUNT(*)::int AS total FROM usuarios
     WHERE ($1::rol_usuario IS NULL OR rol = $1::rol_usuario)`,
    [rol]
  );
  return { usuarios: rows, total: conteo[0].total };
}

/**
 * Suspende (activo=false) o reactiva (activo=true) a un usuario.
 * El control de auto-suspensión vive en el controller (necesita req.user).
 * Retorna null si el usuario no existe.
 *
 * @param {number} id
 * @param {boolean} activo
 * @returns {Promise<Object|null>} Usuario actualizado (columnas seguras)
 */
async function actualizarActivo(id, activo) {
  const { rows } = await query(
    `UPDATE usuarios SET activo = $2 WHERE id = $1
     RETURNING ${COLUMNAS_SEGURAS}`,
    [id, activo]
  );
  return rows[0] || null;
}

module.exports = {
  crear,
  buscarPorEmail,
  buscarPorId,
  buscarParaLogin,
  listar,
  actualizarActivo,
};
