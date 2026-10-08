/**
 * modulos/tutorias/tutorias.routes.js
 * Rutas del módulo tutorias (montado en /api/tutorias).
 * Solicitar solo es posible ONLINE (no se encola en el modo offline).
 */
const { Router } = require('express');

const asyncHandler = require('../../utils/async-handler');
const { authMiddleware, permitirRoles } = require('../../middlewares/auth.middleware');
const validar = require('../../middlewares/validar.middleware');
const {
  validarCrearTutoria,
  validarListarTutorias,
  validarCambiarEstado,
} = require('./tutorias.validators');
const tutoriasController = require('./tutorias.controller');

const router = Router();

/**
 * @swagger
 * /tutorias:
 *   post:
 *     tags: [Tutorias]
 *     summary: Solicita una tutoría (ESTUDIANTE, solo online)
 *     description: >
 *       El estudiante pide una tutoría a un tutor de un curso en el que esté
 *       inscrito. Si envía idCurso debe ser un curso de ese tutor donde esté
 *       inscrito; si no lo envía, basta con estar inscrito en cualquier
 *       curso del tutor. La fecha debe ser futura. Las tutorías NO se
 *       encolan en modo offline: requieren conexión.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idTutor, fecha, tema]
 *             properties:
 *               idTutor: { type: integer, minimum: 1, example: 3 }
 *               idCurso: { type: integer, minimum: 1, nullable: true, example: 1 }
 *               fecha: { type: string, format: date-time, example: '2026-12-01T15:00:00Z' }
 *               tema: { type: string, minLength: 3, maxLength: 300, example: 'Repaso de fracciones' }
 *     responses:
 *       '201':
 *         description: Solicitud creada (estado PENDIENTE)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     tutoria: { $ref: '#/components/schemas/Tutoria' }
 *       '400': { description: Datos inválidos o curso que no pertenece al tutor }
 *       '401': { description: Sin token }
 *       '403': { description: Rol distinto de ESTUDIANTE o no inscrito en un curso del tutor }
 *       '404': { description: Tutor o curso inexistente }
 */
router.post(
  '/',
  authMiddleware,
  permitirRoles('ESTUDIANTE'),
  validarCrearTutoria,
  validar,
  asyncHandler(tutoriasController.crear)
);

/**
 * @swagger
 * /tutorias:
 *   get:
 *     tags: [Tutorias]
 *     summary: Tutorías del usuario autenticado, con filtro por estado
 *     description: >
 *       El ESTUDIANTE ve las tutorías que le pertenecen; el TUTOR ve las
 *       que le piden. Listado paginado.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: estado
 *         schema: { type: string, enum: [PENDIENTE, CONFIRMADA, CANCELADA, REALIZADA] }
 *       - in: query
 *         name: pagina
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limite
 *         schema: { type: integer, minimum: 1, maximum: 50, default: 10 }
 *     responses:
 *       '200':
 *         description: Listado de tutorías
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     tutorias:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Tutoria' }
 *                     pagina: { type: integer, example: 1 }
 *                     limite: { type: integer, example: 10 }
 *                     total: { type: integer, example: 3 }
 *                     totalPaginas: { type: integer, example: 1 }
 *       '400': { description: Filtro estado inválido }
 *       '401': { description: Sin token }
 *       '403': { description: Rol distinto de ESTUDIANTE o TUTOR }
 */
router.get(
  '/',
  authMiddleware,
  permitirRoles('ESTUDIANTE', 'TUTOR'),
  validarListarTutorias,
  validar,
  asyncHandler(tutoriasController.listar)
);

/**
 * @swagger
 * /tutorias/{id}/estado:
 *   patch:
 *     tags: [Tutorias]
 *     summary: Cambia el estado de una tutoría (transiciones permitidas)
 *     description: >
 *       Tabla de transiciones permitidas (409 en cualquier otro caso):
 *       TUTOR — PENDIENTE → CONFIRMADA | CANCELADA; CONFIRMADA → REALIZADA | CANCELADA.
 *       ESTUDIANTE — solo puede cancelar las suyas: PENDIENTE → CANCELADA;
 *       CONFIRMADA → CANCELADA. REALIZADA y CANCELADA son estados terminales.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [estado]
 *             properties:
 *               estado: { type: string, enum: [PENDIENTE, CONFIRMADA, CANCELADA, REALIZADA], example: CONFIRMADA }
 *     responses:
 *       '200':
 *         description: Estado actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     tutoria: { $ref: '#/components/schemas/Tutoria' }
 *       '400': { description: Estado inválido }
 *       '401': { description: Sin token }
 *       '403': { description: Rol distinto de ESTUDIANTE/TUTOR o tutoría ajena }
 *       '404': { description: Tutoría inexistente }
 *       '409': { description: Transición de estado no permitida }
 */
router.patch(
  '/:id/estado',
  authMiddleware,
  permitirRoles('ESTUDIANTE', 'TUTOR'),
  validarCambiarEstado,
  validar,
  asyncHandler(tutoriasController.cambiarEstado)
);

module.exports = router;
