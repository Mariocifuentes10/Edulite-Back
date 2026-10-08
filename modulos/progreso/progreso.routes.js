/**
 * modulos/progreso/progreso.routes.js
 * Rutas del módulo progreso (montado en /api/progreso).
 * GET /api/estudiantes/me/progreso vive en modulos/estudiantes y delega
 * en progreso.service para reutilizar el MISMO cálculo de porcentaje.
 */
const { Router } = require('express');

const asyncHandler = require('../../utils/async-handler');
const { authMiddleware, permitirRoles } = require('../../middlewares/auth.middleware');
const validar = require('../../middlewares/validar.middleware');
const { validarRegistrarProgreso } = require('./progreso.validators');
const progresoController = require('./progreso.controller');

const router = Router();

/**
 * @swagger
 * /progreso:
 *   post:
 *     tags: [Progreso]
 *     summary: Marca o desmarca una lección como completada (ESTUDIANTE inscrito)
 *     description: >
 *       Idempotente: reenviar el mismo par idUsuario+idLeccion nunca duplica
 *       filas (PK compuesta + ON CONFLICT DO UPDATE); solo refresca
 *       actualizado_en. La lección debe pertenecer a un curso donde el
 *       estudiante esté inscrito.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idLeccion, completada]
 *             properties:
 *               idLeccion: { type: integer, minimum: 1, example: 1 }
 *               completada: { type: boolean, example: true }
 *     responses:
 *       '200':
 *         description: Progreso registrado o actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     progreso: { $ref: '#/components/schemas/Progreso' }
 *       '400': { description: Datos inválidos }
 *       '401': { description: Sin token }
 *       '403': { description: Rol distinto de ESTUDIANTE o no inscrito en el curso }
 *       '404': { description: Lección inexistente }
 */
router.post(
  '/',
  authMiddleware,
  permitirRoles('ESTUDIANTE'),
  validarRegistrarProgreso,
  validar,
  asyncHandler(progresoController.registrar)
);

module.exports = router;
