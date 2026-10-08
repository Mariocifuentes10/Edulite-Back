/**
 * middlewares/rate-limit.middleware.js
 * Limitadores de tasa por IP (express-rate-limit) para mitigar abuso y fuerza
 * bruta. En tests (NODE_ENV=test, que Jest fija solo) se DESACTIVAN: así las
 * suites e2e, que disparan muchas peticiones seguidas, no reciben 429 falsos.
 *
 * Respuestas 429 con el envelope uniforme { success, message } vía utils/respuesta.
 */
const rateLimit = require('express-rate-limit');

const env = require('../config/env');
const { fail } = require('../utils/respuesta');

/** true en tests: el limitador se salta por completo. */
const esEntornoDePruebas = env.NODE_ENV === 'test';

/**
 * Respuesta uniforme al superar el límite.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function responderLimiteExcedido(req, res) {
  return fail(
    res,
    429,
    'Demasiadas solicitudes. Espere un momento e intente nuevamente.'
  );
}

/**
 * Limitador global para toda la API: defensa básica contra scraping y floods.
 * 100 peticiones por IP cada minuto.
 */
const limitadorGlobal = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => esEntornoDePruebas,
  handler: responderLimiteExcedido,
});

/**
 * Limitador estricto para POST /auth/login: frena la fuerza bruta de
 * credenciales. 10 intentos por IP cada 15 minutos.
 */
const limitadorLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => esEntornoDePruebas,
  handler: responderLimiteExcedido,
});

/**
 * Limitador para POST /auth/register: evita creación masiva de cuentas.
 * 20 registros por IP cada hora.
 */
const limitadorRegistro = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => esEntornoDePruebas,
  handler: responderLimiteExcedido,
});

module.exports = { limitadorGlobal, limitadorLogin, limitadorRegistro };
