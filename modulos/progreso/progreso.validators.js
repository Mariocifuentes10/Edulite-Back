/**
 * modulos/progreso/progreso.validators.js
 * Validaciones de express-validator del módulo progreso.
 */
const { body, query } = require('express-validator');

const validarRegistrarProgreso = [
  body('idLeccion')
    .isInt({ min: 1 })
    .withMessage('idLeccion debe ser un entero >= 1')
    .toInt(),
  body('completada')
    .isBoolean()
    .withMessage('completada debe ser true o false')
    .toBoolean(),
];

const validarConsultaProgreso = [
  query('cursoId')
    .isInt({ min: 1 })
    .withMessage('cursoId es obligatorio y debe ser un entero >= 1')
    .toInt(),
];

module.exports = { validarRegistrarProgreso, validarConsultaProgreso };
