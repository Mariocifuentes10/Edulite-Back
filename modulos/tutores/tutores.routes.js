/**
 * modulos/tutores/tutores.routes.js
 * Vistas del propio tutor (montado en /api/tutores).
 */
const { Router } = require('express');

const asyncHandler = require('../../utils/async-handler');
const { authMiddleware, permitirRoles } = require('../../middlewares/auth.middleware');
const validar = require('../../middlewares/validar.middleware');
const { validarListadoEstudiantes } = require('./tutores.validators');
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

/**
 * @swagger
 * /tutores/me/estudiantes:
 *   get:
 *     tags: [Tutores]
 *     summary: Avance y último acceso de los estudiantes de SUS cursos
 *     description: >
 *       Una fila por par estudiante-curso, solo de cursos cuyo id_tutor es
 *       el usuario autenticado. El porcentaje se calcula con agregación SQL
 *       (misma fórmula que el resto del backend) y ultimoAcceso es la última
 *       actividad registrada en progreso (null si nunca tuvo actividad).
 *       Listado paginado.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: pagina
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limite
 *         schema: { type: integer, minimum: 1, maximum: 50, default: 10 }
 *     responses:
 *       '200':
 *         description: Estudiantes del tutor con su avance
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     estudiantes:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/EstudianteAvance' }
 *                     pagina: { type: integer, example: 1 }
 *                     limite: { type: integer, example: 10 }
 *                     total: { type: integer, example: 3 }
 *                     totalPaginas: { type: integer, example: 1 }
 *       '400': { description: Parámetros de paginación inválidos }
 *       '401': { description: Sin token }
 *       '403': { description: Rol distinto de TUTOR }
 */
router.get(
  '/me/estudiantes',
  authMiddleware,
  permitirRoles('TUTOR'),
  validarListadoEstudiantes,
  validar,
  asyncHandler(tutoresController.misEstudiantes)
);

/**
 * @swagger
 * /tutores/me/estadisticas:
 *   get:
 *     tags: [Tutores]
 *     summary: Estadísticas agregadas del tutor (sección 5.4)
 *     description: >
 *       Espejo de las estadísticas del estudiante agregado sobre SUS cursos:
 *       avance global de sus estudiantes, avance por curso (con cantidad de
 *       estudiantes), resumen de evaluaciones respondidas por ellos y
 *       tutorías por estado.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Estadísticas del tutor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/EstadisticasTutor' }
 *       '401': { description: Sin token }
 *       '403': { description: Rol distinto de TUTOR }
 */
router.get(
  '/me/estadisticas',
  authMiddleware,
  permitirRoles('TUTOR'),
  asyncHandler(tutoresController.misEstadisticas)
);

module.exports = router;
