/**
 * utils/respuesta.js
 * Envelope único de respuestas: { success, data, message }.
 * Todas las respuestas de la API pasan por aquí para mantener un contrato uniforme.
 */

/**
 * Respuesta exitosa.
 * @param {import('express').Response} res
 * @param {any} data - Carga útil (sin password_hash nunca)
 * @param {string} [message] - Mensaje descriptivo
 * @param {number} [statusCode=200]
 */
function ok(res, data = null, message = 'Operación exitosa', statusCode = 200) {
  return res.status(statusCode).json({ success: true, data, message });
}

/**
 * Respuesta de error uniforme.
 * @param {import('express').Response} res
 * @param {number} statusCode
 * @param {string} message
 * @param {Array|Object} [errors] - Detalles opcionales (validaciones, motivos)
 */
function fail(res, statusCode, message, errors = undefined) {
  const cuerpo = { success: false, message };
  if (errors !== undefined) cuerpo.errors = errors;
  return res.status(statusCode).json(cuerpo);
}

module.exports = { ok, fail };
