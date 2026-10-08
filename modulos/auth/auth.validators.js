/**
 * modulos/auth/auth.validators.js
 * Validaciones de express-validator para las rutas de autenticación.
 * El registro público NUNCA acepta rol ADMIN (se rechaza con 400).
 */
const { body } = require('express-validator');

/** Roles permitidos en el registro público. */
const ROLES_PUBLICOS = ['ESTUDIANTE', 'TUTOR'];

const validacionesRegistro = [
  body('nombre')
    .trim()
    .notEmpty()
    .withMessage('El nombre es obligatorio')
    .isLength({ max: 120 })
    .withMessage('El nombre no puede superar 120 caracteres'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('El email es obligatorio')
    .isEmail()
    .withMessage('El email no tiene un formato válido')
    .normalizeEmail()
    .isLength({ max: 160 })
    .withMessage('El email no puede superar 160 caracteres'),

  body('password')
    .notEmpty()
    .withMessage('La contraseña es obligatoria')
    .isLength({ min: 8 })
    .withMessage('La contraseña debe tener al menos 8 caracteres'),

  body('rol')
    .trim()
    .notEmpty()
    .withMessage('El rol es obligatorio')
    .isIn(ROLES_PUBLICOS)
    .withMessage('El rol debe ser ESTUDIANTE o TUTOR'),

  body('telefono')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 30 })
    .withMessage('El teléfono no puede superar 30 caracteres'),
];

const validacionesLogin = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('El email es obligatorio')
    .isEmail()
    .withMessage('El email no tiene un formato válido')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('La contraseña es obligatoria'),
];

module.exports = { validacionesRegistro, validacionesLogin, ROLES_PUBLICOS };
