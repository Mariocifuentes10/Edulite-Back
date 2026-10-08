/**
 * middlewares/validar.middleware.js
 * Convierte los errores de express-validator en un AppError 400 uniforme.
 * Se coloca DESPUÉS de las cadenas de validación en cada ruta.
 */
const { validationResult } = require('express-validator');
const AppError = require('../utils/app-error');

function validar(req, res, next) {
  const resultado = validationResult(req);
  if (resultado.isEmpty()) return next();

  const errors = resultado.array().map((e) => ({
    campo: e.path,
    mensaje: e.msg,
  }));

  return next(new AppError('Datos inválidos', 400, errors));
}

module.exports = validar;
