/**
 * utils/app-error.js
 * Error de aplicación con código HTTP propio.
 * Lo usan services y middlewares para responder errores uniformes
 * a través de error.middleware.js.
 */
class AppError extends Error {
  /**
   * @param {string} message - Mensaje legible para el cliente
   * @param {number} statusCode - Código HTTP (400, 401, 403, 404, 409, ...)
   * @param {Array|Object} [errors] - Detalles adicionales (ej: errores de validación)
   */
  constructor(message, statusCode = 500, errors = undefined) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.esAppError = true;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

module.exports = AppError;
