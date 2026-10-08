/**
 * modulos/tutorias/tutorias.validators.js
 * Validaciones de express-validator del módulo tutorias.
 */
const { body, param, query } = require('express-validator');

/** Estados posibles de una tutoría (enum estado_tutoria de la base). */
const ESTADOS = ['PENDIENTE', 'CONFIRMADA', 'CANCELADA', 'REALIZADA'];

const validarCrearTutoria = [
  body('idTutor')
    .isInt({ min: 1 })
    .withMessage('idTutor debe ser un entero >= 1')
    .toInt(),
  body('idCurso')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('idCurso debe ser un entero >= 1')
    .toInt(),
  body('fecha')
    .isISO8601()
    .withMessage('fecha debe ser una fecha ISO 8601 válida (ej: 2026-10-15T15:00:00Z)')
    .toDate()
    .custom((fecha) => {
      if (fecha.getTime() <= Date.now()) {
        throw new Error('La fecha debe ser futura');
      }
      return true;
    }),
  body('tema')
    .trim()
    .isLength({ min: 3, max: 300 })
    .withMessage('tema debe tener entre 3 y 300 caracteres'),
];

const validarListarTutorias = [
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
  query('estado')
    .optional({ nullable: true })
    .isIn(ESTADOS)
    .withMessage(`estado debe ser uno de: ${ESTADOS.join(', ')}`),
];

const validarCambiarEstado = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('id de tutoría debe ser un entero >= 1')
    .toInt(),
  body('estado')
    .isIn(ESTADOS)
    .withMessage(`estado debe ser uno de: ${ESTADOS.join(', ')}`),
];

module.exports = {
  ESTADOS,
  validarCrearTutoria,
  validarListarTutorias,
  validarCambiarEstado,
};
