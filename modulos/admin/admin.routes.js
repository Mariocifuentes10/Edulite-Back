/**
 * modulos/admin/admin.routes.js
 * Panel de administración (montado en /api/admin). Todas las rutas requieren
 * rol ADMIN.
 */
const { Router } = require('express');

const asyncHandler = require('../../utils/async-handler');
const { authMiddleware, permitirRoles } = require('../../middlewares/auth.middleware');
const validar = require('../../middlewares/validar.middleware');
const {
  validarListarUsuarios,
  validarCambiarActivo,
} = require('./admin.validators');
const adminController = require('./admin.controller');

const router = Router();

/**
 * @swagger
 * /admin/usuarios:
 *   get:
 *     tags: [Admin]
 *     summary: Lista usuarios paginados con filtro opcional por rol
 *     description: >
 *       Nunca devuelve password_hash. Ordena por fecha de creación descendente.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: rol
 *         schema: { type: string, enum: [ESTUDIANTE, TUTOR, ADMIN] }
 *       - in: query
 *         name: pagina
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limite
 *         schema: { type: integer, minimum: 1, maximum: 50, default: 20 }
 *     responses:
 *       '200':
 *         description: Listado paginado de usuarios
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/PaginaUsuarios' }
 *       '400': { description: Parámetros inválidos }
 *       '401': { description: Sin token }
 *       '403': { description: Rol distinto de ADMIN }
 */
router.get(
  '/usuarios',
  authMiddleware,
  permitirRoles('ADMIN'),
  validarListarUsuarios,
  validar,
  asyncHandler(adminController.listarUsuarios)
);

/**
 * @swagger
 * /admin/usuarios/{id}/activo:
 *   patch:
 *     tags: [Admin]
 *     summary: Suspende o reactiva una cuenta
 *     description: >
 *       activo=false suspende (login y tokens ya emitidos quedan en 403);
 *       activo=true reactiva. Un admin no puede suspender su propia cuenta.
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
 *             required: [activo]
 *             properties:
 *               activo: { type: boolean, example: false }
 *     responses:
 *       '200':
 *         description: Usuario actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     usuario: { $ref: '#/components/schemas/Usuario' }
 *       '400': { description: activo inválido o auto-suspensión }
 *       '401': { description: Sin token }
 *       '403': { description: Rol distinto de ADMIN }
 *       '404': { description: Usuario no encontrado }
 */
router.patch(
  '/usuarios/:id/activo',
  authMiddleware,
  permitirRoles('ADMIN'),
  validarCambiarActivo,
  validar,
  asyncHandler(adminController.cambiarActivo)
);

/**
 * @swagger
 * /admin/estadisticas:
 *   get:
 *     tags: [Admin]
 *     summary: Estadísticas globales de la plataforma
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Usuarios por rol, cursos publicados, lecciones completadas y top de cursos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/EstadisticasAdmin' }
 *       '401': { description: Sin token }
 *       '403': { description: Rol distinto de ADMIN }
 */
router.get(
  '/estadisticas',
  authMiddleware,
  permitirRoles('ADMIN'),
  asyncHandler(adminController.estadisticas)
);

module.exports = router;
