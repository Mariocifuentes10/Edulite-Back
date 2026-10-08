/**
 * modulos/evaluaciones/evaluaciones.routes.js
 * Dos routers porque las rutas viven bajo dos prefijos distintos:
 *   • rutasAnidadas → montado en /api/lecciones  (/lecciones/{id}/evaluaciones)
 *   • rutasPropias  → montado en /api/evaluaciones (/:id/responder)
 */
const { Router } = require('express');

const asyncHandler = require('../../utils/async-handler');
const { authMiddleware, permitirRoles } = require('../../middlewares/auth.middleware');
const {
  requerirDuenoDelCurso,
  requerirAccesoAlCurso,
} = require('../../middlewares/curso.middleware');
const { cargarLeccion } = require('../../middlewares/leccion.middleware');
const validar = require('../../middlewares/validar.middleware');
const { cargarEvaluacion } = require('./evaluacion.middleware');
const {
  validarCrearEvaluacion,
  validarActualizarEvaluacion,
  validarResponderEvaluacion,
} = require('./evaluaciones.validators');
const evaluacionesController = require('./evaluaciones.controller');

const rutasAnidadas = Router();
const rutasPropias = Router();

/**
 * @swagger
 * /lecciones/{id}/evaluaciones:
 *   post:
 *     tags: [Evaluaciones]
 *     summary: Crea una pregunta de opción múltiple en la lección (TUTOR dueño)
 *     description: >
 *       Las opciones deben ser de 2 a 4 textos y la respuesta_correcta debe
 *       coincidir con una de ellas. La respuesta correcta JAMÁS se devuelve
 *       al cliente.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [pregunta, opciones, respuesta_correcta]
 *             properties:
 *               pregunta: { type: string, maxLength: 500, example: '¿Cuánto es 12 + 7?' }
 *               opciones:
 *                 type: array
 *                 minItems: 2
 *                 maxItems: 4
 *                 items: { type: string, maxLength: 500 }
 *                 example: ['19', '15', '21', '24']
 *               respuesta_correcta: { type: string, maxLength: 500, example: '19' }
 *     responses:
 *       '200': { description: Evaluación creada (sin respuesta_correcta) }
 *       '400': { description: Datos inválidos (menos de 2 opciones o respuesta fuera de opciones) }
 *       '401': { description: Sin token }
 *       '403': { description: Rol distinto de TUTOR o curso ajeno }
 *       '404': { description: Lección inexistente }
 *   get:
 *     tags: [Evaluaciones]
 *     summary: Preguntas de la lección SIN respuesta_correcta (estudiantes inscritos)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: Lista liviana de evaluaciones
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     evaluaciones:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/EvaluacionEstudiante' }
 *       '401': { description: Sin token }
 *       '403': { description: No inscrito ni dueño del curso }
 *       '404': { description: Lección inexistente }
 */
rutasAnidadas.post(
  '/:id/evaluaciones',
  authMiddleware,
  permitirRoles('TUTOR'),
  cargarLeccion,
  requerirDuenoDelCurso,
  validarCrearEvaluacion,
  validar,
  asyncHandler(evaluacionesController.crear)
);

rutasAnidadas.get(
  '/:id/evaluaciones',
  authMiddleware,
  cargarLeccion,
  requerirAccesoAlCurso,
  asyncHandler(evaluacionesController.listar)
);

/**
 * @swagger
 * /lecciones/{id}/evaluaciones/{idEvaluacion}:
 *   patch:
 *     tags: [Evaluaciones]
 *     summary: Actualiza una pregunta de la lección (TUTOR dueño)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: idEvaluacion
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               pregunta: { type: string, maxLength: 500 }
 *               opciones:
 *                 type: array
 *                 minItems: 2
 *                 maxItems: 4
 *                 items: { type: string, maxLength: 500 }
 *               respuesta_correcta: { type: string, maxLength: 500 }
 *     responses:
 *       '200': { description: Evaluación actualizada (sin respuesta_correcta) }
 *       '400': { description: Datos inválidos o respuesta fuera de las opciones vigentes }
 *       '401': { description: Sin token }
 *       '403': { description: Rol distinto de TUTOR o curso ajeno }
 *       '404': { description: Evaluación no pertenece a la lección o no existe }
 *   delete:
 *     tags: [Evaluaciones]
 *     summary: Elimina una pregunta de la lección (TUTOR dueño)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: idEvaluacion
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200': { description: Evaluación eliminada }
 *       '401': { description: Sin token }
 *       '403': { description: Rol distinto de TUTOR o curso ajeno }
 *       '404': { description: Evaluación no pertenece a la lección o no existe }
 */
rutasAnidadas.patch(
  '/:id/evaluaciones/:idEvaluacion',
  authMiddleware,
  permitirRoles('TUTOR'),
  cargarLeccion,
  requerirDuenoDelCurso,
  validarActualizarEvaluacion,
  validar,
  asyncHandler(evaluacionesController.actualizar)
);

rutasAnidadas.delete(
  '/:id/evaluaciones/:idEvaluacion',
  authMiddleware,
  permitirRoles('TUTOR'),
  cargarLeccion,
  requerirDuenoDelCurso,
  asyncHandler(evaluacionesController.eliminar)
);

/**
 * @swagger
 * /evaluaciones/{id}/responder:
 *   post:
 *     tags: [Evaluaciones]
 *     summary: Responde una evaluación; el servidor califica (ESTUDIANTE inscrito)
 *     description: >
 *       Idempotente por idCliente (UUID v4 generado en el navegador): reenviar
 *       el mismo idCliente nunca crea un segundo resultado; responde 201 la
 *       primera vez y 200 con la calificación original en los intentos
 *       siguientes. La calificación se calcula SIEMPRE en el servidor.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idCliente, respuesta]
 *             properties:
 *               idCliente:
 *                 type: string
 *                 format: uuid
 *                 example: '3f1a9c0e-6f4b-4a52-9d21-1c8e5b7a2d90'
 *               respuesta: { type: string, maxLength: 500, example: '19' }
 *     responses:
 *       '200':
 *         description: idCliente ya registrado (se devuelve la calificación original)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     correcta: { type: boolean, example: true }
 *       '201':
 *         description: Respuesta registrada y calificada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     correcta: { type: boolean, example: true }
 *       '400': { description: Datos inválidos (idCliente no es UUID v4) }
 *       '401': { description: Sin token }
 *       '403': { description: Rol distinto de ESTUDIANTE o no inscrito }
 *       '404': { description: Evaluación inexistente }
 *       '409': { description: idCliente ya registrado por otro usuario }
 */
rutasPropias.post(
  '/:id/responder',
  authMiddleware,
  permitirRoles('ESTUDIANTE'),
  cargarEvaluacion,
  requerirAccesoAlCurso,
  validarResponderEvaluacion,
  validar,
  asyncHandler(evaluacionesController.responder)
);

module.exports = { rutasAnidadas, rutasPropias };
