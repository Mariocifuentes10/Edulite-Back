/**
 * middlewares/error.middleware.js
 * Último middleware de la cadena. Normaliza CUALQUIER error al envelope
 * { success:false, message, errors? } sin filtrar detalles internos.
 */
const env = require('../config/env');
const { fail } = require('../utils/respuesta');

// Mapeo de códigos de error de PostgreSQL a respuestas HTTP.
const ERRORES_PG = {
  23505: { status: 409, mensaje: 'El registro ya existe (restricción de unicidad)' },
  23503: { status: 400, mensaje: 'Referencia inválida a un registro inexistente' },
  23502: { status: 400, mensaje: 'Falta un campo obligatorio' },
  '22P02': { status: 400, mensaje: 'Formato de dato inválido' },
};

function manejarErrores(err, req, res, next) {
  if (res.headersSent) return next(err);

  // 1. Errores de aplicación (AppError): mensaje y código propios.
  if (err && err.esAppError) {
    return fail(res, err.statusCode, err.message, err.errors);
  }

  // 2. Cuerpo JSON malformado (express.json).
  if (err && err.type === 'entity.parse.failed') {
    return fail(res, 400, 'El cuerpo de la petición no es JSON válido');
  }
  if (err && err.type === 'entity.too.large') {
    return fail(res, 413, 'El cuerpo de la petición es demasiado grande');
  }

  // 3. Errores de PostgreSQL.
  if (err && err.code && ERRORES_PG[err.code]) {
    const info = ERRORES_PG[err.code];
    console.warn(`[pg ${err.code}] ${err.message}`);
    return fail(res, info.status, info.mensaje);
  }

  // 4. Cualquier otro error: 500 sin exponer internos en producción.
  console.error('[error no controlado]', err);
  const mensaje = env.ES_PRODUCCION ? 'Error interno del servidor' : err.message || 'Error interno del servidor';
  return fail(res, 500, mensaje);
}

module.exports = manejarErrores;
