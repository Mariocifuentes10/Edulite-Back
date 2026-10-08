/**
 * modulos/tutores/tutores.controller.js
 * Vistas del propio tutor ("me"). Aquí vive GET /api/tutores/me/cursos;
 * el Sprint 5 agrega /me/estudiantes y /me/estadisticas.
 */
const cursosService = require('../cursos/cursos.service');
const { ok } = require('../../utils/respuesta');

/**
 * GET /api/tutores/me/cursos — todos los cursos del tutor (publicados o no).
 */
async function misCursos(req, res) {
  const cursos = await cursosService.listarDelTutor(req.user.id);
  return ok(res, { cursos });
}

module.exports = { misCursos };
