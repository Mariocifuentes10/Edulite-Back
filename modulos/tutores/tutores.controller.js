/**
 * modulos/tutores/tutores.controller.js
 * Vistas del propio tutor ("me"). Aquí viven GET /api/tutores/me/cursos,
 * /me/estudiantes y /me/estadisticas. El porcentaje NO se calcula aquí:
 * se delega en tutores.service (agregación SQL con utils/porcentaje.js).
 */
const cursosService = require('../cursos/cursos.service');
const tutoresService = require('./tutores.service');
const { ok } = require('../../utils/respuesta');

/**
 * GET /api/tutores/me/cursos — todos los cursos del tutor (publicados o no).
 */
async function misCursos(req, res) {
  const cursos = await cursosService.listarDelTutor(req.user.id);
  return ok(res, { cursos });
}

/**
 * GET /api/tutores/me/estudiantes — avance y último acceso de los
 * estudiantes inscritos en SUS cursos (paginado).
 */
async function misEstudiantes(req, res) {
  const pagina = Number(req.query.pagina) || 1;
  const limite = Number(req.query.limite) || 10;
  const { estudiantes, total } = await tutoresService.listarEstudiantes({
    idTutor: req.user.id,
    pagina,
    limite,
  });
  return ok(res, {
    estudiantes,
    pagina,
    limite,
    total,
    totalPaginas: Math.max(Math.ceil(total / limite), 1),
  });
}

/**
 * GET /api/tutores/me/estadisticas — sección 5.4: avance global de SUS
 * estudiantes, avance por curso, resumen de evaluaciones y tutorías.
 */
async function misEstadisticas(req, res) {
  const datos = await tutoresService.estadisticas(req.user.id);
  return ok(res, datos);
}

module.exports = { misCursos, misEstudiantes, misEstadisticas };
