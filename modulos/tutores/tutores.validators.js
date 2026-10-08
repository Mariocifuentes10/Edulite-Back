/**
 * modulos/tutores/tutores.validators.js
 * Validaciones de express-validator del módulo tutores.
 */
const { query } = require('express-validator');

const validarListadoEstudiantes = [
  query('pagina')
    .optional()
    .isInt({ min: 1 })
    .withMessage('pagina debe ser un entero >= 1')
    .toInt(),
  query('limite')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('limite debe estar entre 1 y 50')
    .toInt(),
];

module.exports = { validarListadoEstudiantes };
