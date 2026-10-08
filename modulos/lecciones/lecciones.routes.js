/**
 * modulos/lecciones/lecciones.routes.js
 * Rutas de lecciones por id (montado en /api/lecciones).
 * Las lecciones anidadas a un curso viven en modulos/cursos/cursos.routes.js.
 */
const { Router } = require('express');

const asyncHandler = require('../../utils/async-handler');
const { authMiddleware } = require('../../middlewares/auth.middleware');
const { requerirAccesoAlCurso } = require('../../middlewares/curso.middleware');
const { cargarLeccion } = require('../../middlewares/leccion.middleware');
const { cacheControl } = require('../../middlewares/cache.middleware');
const leccionesController = require('./lecciones.controller');

const router = Router();

/**
 * @swagger
 * /lecciones/{id}:
 *   get:
 *     tags: [Lecciones]
 *     summary: Lección completa con contenido (dueño, estudiante inscrito o ADMIN)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: Lección con contenido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     leccion: { $ref: '#/components/schemas/Leccion' }
 *       '401': { description: Sin token }
 *       '403': { description: No inscrito ni dueño del curso }
 *       '404': { description: Lección inexistente }
 */
router.get(
  '/:id',
  authMiddleware,
  cargarLeccion,
  requerirAccesoAlCurso,
  cacheControl(60, 'private'),
  asyncHandler(leccionesController.obtener)
);

module.exports = router;
