/**
 * modulos/inscripciones/inscripciones.routes.js
 * Rutas de inscripciones (montado en /api/cursos para /:id/inscribirse).
 */
const { Router } = require('express');

const asyncHandler = require('../../utils/async-handler');
const { authMiddleware, permitirRoles } = require('../../middlewares/auth.middleware');
const { cargarCurso } = require('../../middlewares/curso.middleware');
const inscripcionesController = require('./inscripciones.controller');

const router = Router();

/**
 * @swagger
 * /cursos/{id}/inscribirse:
 *   post:
 *     tags: [Inscripciones]
 *     summary: Inscribe al estudiante autenticado (idempotente)
 *     description: >
 *       Reenviar la misma petición nunca falla ni duplica: la primera responde
 *       201 y las siguientes 200 "Ya estaba inscrito".
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200': { description: Ya estaba inscrito }
 *       '201': { description: Inscripción creada }
 *       '401': { description: Sin token }
 *       '403': { description: Rol distinto de ESTUDIANTE }
 *       '404': { description: Curso inexistente }
 *       '409': { description: El curso no está publicado }
 */
router.post(
  '/:id/inscribirse',
  authMiddleware,
  permitirRoles('ESTUDIANTE'),
  cargarCurso,
  asyncHandler(inscripcionesController.inscribirse)
);

module.exports = router;
