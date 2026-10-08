/**
 * modulos/cursos/cursos.routes.js
 * Rutas de cursos (montado en /api/cursos), incluidas las lecciones anidadas
 * cuyo controlador vive en modulos/lecciones (reutilizamos el middleware de
 * pertenencia sobre el curso en vez de duplicar SQL).
 */
const { Router } = require('express');

const asyncHandler = require('../../utils/async-handler');
const validar = require('../../middlewares/validar.middleware');
const {
  authMiddleware,
  authOpcional,
  permitirRoles,
} = require('../../middlewares/auth.middleware');
const {
  cargarCurso,
  requerirDuenoDelCurso,
  requerirAccesoAlCurso,
} = require('../../middlewares/curso.middleware');
const { cacheControl } = require('../../middlewares/cache.middleware');

const {
  validarListadoCursos,
  validarCrearCurso,
  validarActualizarCurso,
} = require('./cursos.validators');
const cursosController = require('./cursos.controller');

const {
  validarCrearLeccion,
  validarActualizarLeccion,
} = require('../lecciones/lecciones.validators');
const leccionesController = require('../lecciones/lecciones.controller');

const router = Router();

/**
 * @swagger
 * /cursos:
 *   get:
 *     tags: [Cursos]
 *     summary: Catálogo público de cursos publicados (paginado)
 *     security: []
 *     parameters:
 *       - in: query
 *         name: pagina
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limite
 *         schema: { type: integer, minimum: 1, maximum: 50, default: 10 }
 *       - in: query
 *         name: nivel
 *         schema: { type: string, maxLength: 40 }
 *         description: Filtro exacto de nivel
 *       - in: query
 *         name: q
 *         schema: { type: string, maxLength: 80 }
 *         description: Búsqueda en título o descripción
 *     responses:
 *       '200':
 *         description: Página de cursos publicados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/PaginaCursos' }
 *                 message: { type: string }
 *       '400': { description: Parámetros de paginación inválidos }
 */
router.get(
  '/',
  cacheControl(300, 'public'),
  validarListadoCursos,
  validar,
  asyncHandler(cursosController.listar)
);

/**
 * @swagger
 * /cursos/{id}:
 *   get:
 *     tags: [Cursos]
 *     summary: Detalle de un curso con sus lecciones (sin contenido)
 *     description: >
 *       Público si el curso está publicado. Un curso NO publicado solo puede
 *       verlo su dueño o un ADMIN; para los demás responde 404.
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: Detalle del curso y resumen de lecciones
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     curso: { $ref: '#/components/schemas/Curso' }
 *                     lecciones:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/LeccionResumen' }
 *       '401': { description: Token inválido o expirado }
 *       '404': { description: Curso inexistente o borrador ajeno }
 */
router.get(
  '/:id',
  authOpcional,
  cargarCurso,
  cacheControl(60, 'private'),
  asyncHandler(cursosController.detalle)
);

/**
 * @swagger
 * /cursos:
 *   post:
 *     tags: [Cursos]
 *     summary: Crea un curso en borrador (solo TUTOR)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [titulo]
 *             properties:
 *               titulo: { type: string, maxLength: 160, example: "Álgebra para principiantes" }
 *               descripcion: { type: string, maxLength: 2000 }
 *               nivel: { type: string, maxLength: 40, example: secundaria }
 *     responses:
 *       '201': { description: Curso creado (en borrador) }
 *       '400': { description: Datos inválidos }
 *       '401': { description: Sin token }
 *       '403': { description: Rol distinto de TUTOR }
 *       '409': { description: Ya tiene un curso con ese título }
 */
router.post(
  '/',
  authMiddleware,
  permitirRoles('TUTOR'),
  validarCrearCurso,
  validar,
  asyncHandler(cursosController.crear)
);

/**
 * @swagger
 * /cursos/{id}:
 *   patch:
 *     tags: [Cursos]
 *     summary: Actualiza el propio curso (solo TUTOR dueño)
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
 *             properties:
 *               titulo: { type: string, maxLength: 160 }
 *               descripcion: { type: string, maxLength: 2000 }
 *               nivel: { type: string, maxLength: 40 }
 *               publicado: { type: boolean, example: true }
 *     responses:
 *       '200': { description: Curso actualizado }
 *       '400': { description: Sin campos válidos o datos inválidos }
 *       '403': { description: El curso pertenece a otro tutor }
 *       '404': { description: Curso inexistente }
 *       '409': { description: Título duplicado entre los cursos del tutor }
 */
router.patch(
  '/:id',
  authMiddleware,
  permitirRoles('TUTOR'),
  cargarCurso,
  requerirDuenoDelCurso,
  validarActualizarCurso,
  validar,
  asyncHandler(cursosController.actualizar)
);

/**
 * @swagger
 * /cursos/{id}:
 *   delete:
 *     tags: [Cursos]
 *     summary: Elimina el propio curso y sus lecciones (solo TUTOR dueño)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200': { description: Curso eliminado }
 *       '403': { description: El curso pertenece a otro tutor }
 *       '404': { description: Curso inexistente }
 */
router.delete(
  '/:id',
  authMiddleware,
  permitirRoles('TUTOR'),
  cargarCurso,
  requerirDuenoDelCurso,
  asyncHandler(cursosController.eliminar)
);

/**
 * @swagger
 * /cursos/{id}/lecciones:
 *   get:
 *     tags: [Lecciones]
 *     summary: Lista de lecciones SIN contenido (dueño, inscrito o ADMIN)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: Lecciones ordenadas (solo id, orden y título)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     lecciones:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/LeccionResumen' }
 *       '401': { description: Sin token }
 *       '403': { description: No inscrito ni dueño }
 *       '404': { description: Curso inexistente }
 */
router.get(
  '/:id/lecciones',
  authMiddleware,
  cargarCurso,
  requerirAccesoAlCurso,
  cacheControl(60, 'private'),
  asyncHandler(leccionesController.listarPorCurso)
);

/**
 * @swagger
 * /cursos/{id}/lecciones:
 *   post:
 *     tags: [Lecciones]
 *     summary: Crea una lección en el propio curso (solo TUTOR dueño)
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
 *             required: [orden, titulo]
 *             properties:
 *               orden: { type: integer, minimum: 1, example: 1 }
 *               titulo: { type: string, maxLength: 160 }
 *               contenido: { type: string, maxLength: 50000, description: "Texto liviano / Markdown simple" }
 *     responses:
 *       '201': { description: Lección creada }
 *       '403': { description: No es el dueño del curso }
 *       '409': { description: Ese orden ya está usado en el curso }
 */
router.post(
  '/:id/lecciones',
  authMiddleware,
  permitirRoles('TUTOR'),
  cargarCurso,
  requerirDuenoDelCurso,
  validarCrearLeccion,
  validar,
  asyncHandler(leccionesController.crear)
);

/**
 * @swagger
 * /cursos/{id}/lecciones/{idLeccion}:
 *   patch:
 *     tags: [Lecciones]
 *     summary: Actualiza una lección del propio curso (solo TUTOR dueño)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: idLeccion
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               orden: { type: integer, minimum: 1 }
 *               titulo: { type: string, maxLength: 160 }
 *               contenido: { type: string, maxLength: 50000 }
 *     responses:
 *       '200': { description: Lección actualizada }
 *       '403': { description: No es el dueño del curso }
 *       '404': { description: Lección inexistente o de otro curso }
 *       '409': { description: Ese orden ya está usado en el curso }
 */
router.patch(
  '/:id/lecciones/:idLeccion',
  authMiddleware,
  permitirRoles('TUTOR'),
  cargarCurso,
  requerirDuenoDelCurso,
  validarActualizarLeccion,
  validar,
  asyncHandler(leccionesController.actualizar)
);

/**
 * @swagger
 * /cursos/{id}/lecciones/{idLeccion}:
 *   delete:
 *     tags: [Lecciones]
 *     summary: Elimina una lección del propio curso (solo TUTOR dueño)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: idLeccion
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200': { description: Lección eliminada }
 *       '403': { description: No es el dueño del curso }
 *       '404': { description: Lección inexistente o de otro curso }
 */
router.delete(
  '/:id/lecciones/:idLeccion',
  authMiddleware,
  permitirRoles('TUTOR'),
  cargarCurso,
  requerirDuenoDelCurso,
  asyncHandler(leccionesController.eliminar)
);

module.exports = router;
