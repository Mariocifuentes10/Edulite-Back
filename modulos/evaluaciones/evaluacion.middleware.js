/**
 * modulos/evaluaciones/evaluacion.middleware.js
 * cargarEvaluacion: carga la evaluación de :id junto con su lección y curso
 * en req.evaluacion / req.leccion / req.curso, para que requerirAccesoAlCurso
 * (middlewares/curso.middleware.js) pueda evaluar el acceso del estudiante.
 *
 * OJO: req.evaluacion SÍ contiene respuesta_correcta; solo se usa en el
 * servidor para calificar y jamás se serializa en la respuesta.
 */
const AppError = require('../../utils/app-error');
const evaluacionesService = require('./evaluaciones.service');
const leccionesService = require('../lecciones/lecciones.service');
const cursosService = require('../cursos/cursos.service');

async function cargarEvaluacion(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return next(new AppError('Evaluación no encontrada', 404));
    }

    const evaluacion = await evaluacionesService.buscarPorId(id);
    if (!evaluacion) {
      return next(new AppError('Evaluación no encontrada', 404));
    }

    const leccion = await leccionesService.buscarPorId(evaluacion.id_leccion);
    if (!leccion) {
      return next(new AppError('Evaluación no encontrada', 404));
    }

    const curso = await cursosService.buscarPorId(leccion.id_curso);
    if (!curso) {
      return next(new AppError('Evaluación no encontrada', 404));
    }

    req.evaluacion = evaluacion;
    req.leccion = leccion;
    req.curso = curso;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { cargarEvaluacion };
