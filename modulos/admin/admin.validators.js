/**
 * modulos/admin/admin.validators.js
 * Validaciones de express-validator del panel de administración.
 */
const { body, param, query } = require('express-validator');

/** Roles válidos (enum rol_usuario de la base). */
const ROLES = ['ESTUDIANTE', 'TUTOR', 'ADMIN'];

const validarListarUsuarios = [
  query('rol')
    .optional({ nullable: true })
    .isIn(ROLES)
    .withMessage(`rol debe ser uno de: ${ROLES.join(', ')}`),
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

const validarCambiarActivo = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('id de usuario debe ser un entero >= 1')
    .toInt(),
  body('activo')
    .isBoolean()
    .withMessage('activo debe ser booleano (true o false)')
    .toBoolean(),
];

module.exports = { ROLES, validarListarUsuarios, validarCambiarActivo };
