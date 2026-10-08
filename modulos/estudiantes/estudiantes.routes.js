/**
 * modulos/estudiantes/estudiantes.routes.js
 * Vistas del propio estudiante (montado en /api/estudiantes).
 */
const { Router } = require('express');

const asyncHandler = require('../../utils/async-handler');
const { authMiddleware, permitirRoles } = require('../../middlewares/auth.middleware');
const validar = require('../../middlewares/validar.middleware');
const { validarConsultaProgreso } = require('../progreso/progreso.validators');
const estudiantesController = require('./estudiantes.controller');

const router = Router();

/**
 * @swagger
 * /estudiantes/me/cursos:
 *   get:
 *     tags: [Inscripciones]
 *     summary: Cursos en los que está inscrito el estudiante autenticado
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Cursos del estudiante
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     cursos:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Curso' }
 *       '401': { description: Sin token }
 *       '403': { description: Rol distinto de ESTUDIANTE }
 */
router.get(
  '/me/cursos',
  authMiddleware,
  permitirRoles('ESTUDIANTE'),
  asyncHandler(estudiantesController.misCursos)
);

/**
 * @swagger
 * /estudiantes/me/progreso:
 *   get:
 *     tags: [Progreso]
 *     summary: Lecciones completadas y porcentaje de avance en un curso
 *     description: >
 *       El porcentaje se calcula con una única agregación SQL definida en
 *       progreso.service (mismo número que muestra el frontend).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: cursoId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       '200':
 *         description: Avance del curso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     curso: { $ref: '#/components/schemas/CursoResumen' }
 *                     lecciones:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/LeccionProgreso' }
 *                     completadas: { type: integer, example: 3 }
 *                     totales: { type: integer, example: 4 }
 *                     porcentaje: { type: integer, minimum: 0, maximum: 100, example: 75 }
 *       '400': { description: cursoId ausente o inválido }
 *       '401': { description: Sin token }
 *       '403': { description: Rol distinto de ESTUDIANTE o no inscrito }
 *       '404': { description: Curso inexistente }
 */
router.get(
  '/me/progreso',
  authMiddleware,
  permitirRoles('ESTUDIANTE'),
  validarConsultaProgreso,
  validar,
  asyncHandler(estudiantesController.miProgreso)
);

/**
 * @swagger
 * /estudiantes/me/estadisticas:
 *   get:
 *     tags: [Progreso]
 *     summary: Estadísticas del estudiante (sección 5.4)
 *     description: >
 *       Avance global (lecciones completadas/totales y porcentaje), avance
 *       por curso, resumen de evaluaciones (respondidas, correctas y
 *       precisión) y racha de días consecutivos con actividad.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Estadísticas del estudiante
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/EstadisticasEstudiante' }
 *       '401': { description: Sin token }
 *       '403': { description: Rol distinto de ESTUDIANTE }
 */
router.get(
  '/me/estadisticas',
  authMiddleware,
  permitirRoles('ESTUDIANTE'),
  asyncHandler(estudiantesController.estadisticas)
);

module.exports = router;
