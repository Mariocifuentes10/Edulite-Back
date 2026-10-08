/**
 * modulos/tutores/tutores.routes.js
 * Vistas del propio tutor (montado en /api/tutores).
 * El Sprint 5 agrega aquí más endpoints (/me/estudiantes, /me/estadisticas).
 */
const { Router } = require('express');

const asyncHandler = require('../../utils/async-handler');
const { authMiddleware, permitirRoles } = require('../../middlewares/auth.middleware');
const tutoresController = require('./tutores.controller');

const router = Router();

/**
 * @swagger
 * /tutores/me/cursos:
 *   get:
 *     tags: [Cursos]
 *     summary: Todos los cursos del tutor autenticado (publicados o no)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Cursos del tutor
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
 *       '403': { description: Rol distinto de TUTOR }
 */
router.get(
  '/me/cursos',
  authMiddleware,
  permitirRoles('TUTOR'),
  asyncHandler(tutoresController.misCursos)
);

module.exports = router;
