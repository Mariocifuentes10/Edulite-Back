/**
 * middlewares/not-found.middleware.js
 * Responde 404 para cualquier ruta no registrada bajo /api.
 */
const { fail } = require('../utils/respuesta');

function noEncontrado(req, res) {
  return fail(res, 404, `Ruta no encontrada: ${req.method} ${req.originalUrl}`);
}

module.exports = noEncontrado;
