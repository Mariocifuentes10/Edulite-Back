/**
 * modulos/cursos/cursos.validators.js
 * Validaciones de express-validator del módulo cursos.
 */
const { body, query } = require('express-validator');

/** Campos permitidos en PATCH /api/cursos/:id */
const CAMPOS_ACTUALIZABLES = ['titulo', 'descripcion', 'nivel', 'publicado'];

const validarListadoCursos = [
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
  query('nivel')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 40 })
    .withMessage('nivel no puede superar 40 caracteres'),
  query('q')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 80 })
    .withMessage('q no puede superar 80 caracteres'),
];

const validarCrearCurso = [
  body('titulo')
    .trim()
    .notEmpty()
    .withMessage('El título es obligatorio')
    .isLength({ max: 160 })
    .withMessage('El título no puede superar 160 caracteres'),
  body('descripcion')
    .optional({ nullable: true })
    .isLength({ max: 2000 })
    .withMessage('La descripción no puede superar 2000 caracteres'),
  body('nivel')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 40 })
    .withMessage('El nivel no puede superar 40 caracteres'),
];

const validarActualizarCurso = [
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
  body('titulo')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('El título no puede estar vacío')
    .isLength({ max: 160 })
    .withMessage('El título no puede superar 160 caracteres'),
  body('descripcion')
    .optional({ nullable: true })
    .isLength({ max: 2000 })
    .withMessage('La descripción no puede superar 2000 caracteres'),
  body('nivel')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 40 })
    .withMessage('El nivel no puede superar 40 caracteres'),
  body('publicado')
    .optional()
    .isBoolean()
    .withMessage('publicado debe ser true o false')
    .toBoolean(),
];

module.exports = { validarListadoCursos, validarCrearCurso, validarActualizarCurso };
