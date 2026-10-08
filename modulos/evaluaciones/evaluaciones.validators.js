/**
 * modulos/evaluaciones/evaluaciones.validators.js
 * Validaciones de express-validator del módulo evaluaciones.
 * Reglas: opciones entre 2 y 4 textos; respuesta_correcta dentro de opciones.
 */
const { body } = require('express-validator');
const { esUuidV4 } = require('../../utils/uuid');

/** Campos permitidos en PATCH /api/lecciones/:id/evaluaciones/:idEvaluacion */
const CAMPOS_ACTUALIZABLES = ['pregunta', 'opciones', 'respuesta_correcta'];

const validarCrearEvaluacion = [
  body('pregunta')
    .trim()
    .notEmpty()
    .withMessage('La pregunta es obligatoria')
    .isLength({ max: 500 })
    .withMessage('La pregunta no puede superar 500 caracteres'),
  body('opciones')
    .isArray({ min: 2, max: 4 })
    .withMessage('Debe enviar entre 2 y 4 opciones'),
  body('opciones.*')
    .isString()
    .withMessage('Cada opción debe ser un texto')
    .trim()
    .notEmpty()
    .withMessage('Las opciones no pueden estar vacías')
    .isLength({ max: 500 })
    .withMessage('Cada opción no puede superar 500 caracteres'),
  body('respuesta_correcta')
    .trim()
    .notEmpty()
    .withMessage('La respuesta correcta es obligatoria')
    .isLength({ max: 500 })
    .withMessage('La respuesta correcta no puede superar 500 caracteres')
    .custom((valor, { req }) => {
      if (Array.isArray(req.body.opciones) && !req.body.opciones.includes(valor)) {
        throw new Error('La respuesta_correcta debe ser una de las opciones');
      }
      return true;
    }),
];

const validarActualizarEvaluacion = [
  body().custom((valor) => {
    const enviado = CAMPOS_ACTUALIZABLES.some(
      (campo) => valor[campo] !== undefined
    );
    if (!enviado) {
      throw new Error(
        `Debe enviar al menos uno de: ${CAMPOS_ACTUALIZABLES.join(', ')}`
      );
    }
    return true;
  }),
  body('pregunta')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('La pregunta no puede estar vacía')
    .isLength({ max: 500 })
    .withMessage('La pregunta no puede superar 500 caracteres'),
  body('opciones')
    .optional()
    .isArray({ min: 2, max: 4 })
    .withMessage('Debe enviar entre 2 y 4 opciones'),
  body('opciones.*')
    .isString()
    .withMessage('Cada opción debe ser un texto')
    .trim()
    .notEmpty()
    .withMessage('Las opciones no pueden estar vacías')
    .isLength({ max: 500 })
    .withMessage('Cada opción no puede superar 500 caracteres'),
  body('respuesta_correcta')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('La respuesta correcta no puede estar vacía')
    .isLength({ max: 500 })
    .withMessage('La respuesta correcta no puede superar 500 caracteres')
    .custom((valor, { req }) => {
      if (Array.isArray(req.body.opciones) && !req.body.opciones.includes(valor)) {
        throw new Error('La respuesta_correcta debe ser una de las opciones');
      }
      return true;
    }),
];

const validarResponderEvaluacion = [
  body('idCliente')
    .custom((valor) => esUuidV4(valor))
    .withMessage('idCliente debe ser un UUID v4 generado por el cliente'),
  body('respuesta')
    .trim()
    .notEmpty()
    .withMessage('La respuesta es obligatoria')
    .isLength({ max: 500 })
    .withMessage('La respuesta no puede superar 500 caracteres'),
];

module.exports = {
  validarCrearEvaluacion,
  validarActualizarEvaluacion,
  validarResponderEvaluacion,
};
