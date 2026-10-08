/**
 * modulos/estudiantes/estudiantes.controller.js
 * Vistas del propio estudiante ("me"). El porcentaje NO se calcula aquí:
 * se delega en progreso.service (único lugar con la fórmula de avance).
 */
const inscripcionesService = require('../inscripciones/inscripciones.service');
const progresoService = require('../progreso/progreso.service');
const estudiantesService = require('./estudiantes.service');
const { ok } = require('../../utils/respuesta');

/**
 * GET /api/estudiantes/me/cursos — cursos en los que está inscrito.
 */
async function misCursos(req, res) {
  const cursos = await inscripcionesService.listarCursosDelEstudiante(req.user.id);
  return ok(res, { cursos });
}

/**
 * GET /api/estudiantes/me/progreso?cursoId= — lecciones completadas y
 * porcentaje de avance del curso (agregación SQL única en progreso.service).
 */
async function miProgreso(req, res) {
  const avance = await progresoService.obtenerProgresoCurso(
    req.user.id,
    req.query.cursoId
  );
  return ok(res, avance);
}

/**
 * GET /api/estudiantes/me/estadisticas — sección 5.4: avance global,
 * avance por curso, resumen de evaluaciones y racha de días con actividad.
 */
async function estadisticas(req, res) {
  const datos = await estudiantesService.estadisticas(req.user.id);
  return ok(res, datos);
}

module.exports = { misCursos, miProgreso, estadisticas };
