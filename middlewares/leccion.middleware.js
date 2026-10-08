/**
 * middlewares/leccion.middleware.js
 * cargarLeccion: carga la lección de :id y su curso asociado en req.leccion / req.curso,
 * para que requerirAccesoAlCurso (middlewares/curso.middleware.js) pueda evaluar el acceso.
 */
const AppError = require('../utils/app-error');
const leccionesService = require('../modulos/lecciones/lecciones.service');
const cursosService = require('../modulos/cursos/cursos.service');

async function cargarLeccion(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return next(new AppError('Lección no encontrada', 404));
    }
    const leccion = await leccionesService.buscarPorId(id);
    if (!leccion) return next(new AppError('Lección no encontrada', 404));

    const curso = await cursosService.buscarPorId(leccion.id_curso);
    if (!curso) return next(new AppError('Lección no encontrada', 404));

    req.leccion = leccion;
    req.curso = curso;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { cargarLeccion };
