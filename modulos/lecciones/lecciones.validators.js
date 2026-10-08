/**
 * modulos/lecciones/lecciones.validators.js
 * Validaciones de express-validator del módulo lecciones.
 */
const { body } = require('express-validator');

const CAMPOS_ACTUALIZABLES = ['orden', 'titulo', 'contenido'];

const validarCrearLeccion = [
  body('orden')
    .isInt({ min: 1 })
    .withMessage('El orden debe ser un entero >= 1')
    .toInt(),
  body('titulo')
    .trim()
    .notEmpty()
    .withMessage('El título es obligatorio')
    .isLength({ max: 160 })
    .withMessage('El título no puede superar 160 caracteres'),
  body('contenido')
    .optional({ nullable: true })
    .isLength({ max: 50000 })
    .withMessage('El contenido no puede superar 50000 caracteres'),
];

const validarActualizarLeccion = [
  body()
    .custom((valor) => {
      const enviado = CAMPOS_ACTUALIZABLES.some((campo) => valor[campo] !== undefined);
      if (!enviado) {
        throw new Error(
          `Debe enviar al menos uno de: ${CAMPOS_ACTUALIZABLES.join(', ')}`
        );
      }
      return true;
    }),
  body('orden')
    .optional()
    .isInt({ min: 1 })
    .withMessage('El orden debe ser un entero >= 1')
    .toInt(),
  body('titulo')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('El título no puede estar vacío')
    .isLength({ max: 160 })
    .withMessage('El título no puede superar 160 caracteres'),
  body('contenido')
    .optional({ nullable: true })
    .isLength({ max: 50000 })
    .withMessage('El contenido no puede superar 50000 caracteres'),
];

module.exports = { validarCrearLeccion, validarActualizarLeccion };
