/**
 * middlewares/curso.middleware.js
 * Verificación de pertenencia REUTILIZABLE sobre el recurso curso:
 *   • cargarCurso          → 404 si el curso no existe; deja req.curso.
 *   • requerirDuenoDelCurso→ 403 si el curso no pertenece al tutor autenticado.
 *   • requerirAccesoAlCurso→ 403 salvo que seas: dueño, ADMIN o ESTUDIANTE inscrito.
 */
const AppError = require('../utils/app-error');
const cursosService = require('../modulos/cursos/cursos.service');
const inscripcionesService = require('../modulos/inscripciones/inscripciones.service');

/**
 * Carga el curso indicado en :id. Si no existe (o el id es inválido) responde 404.
 */
async function cargarCurso(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return next(new AppError('Curso no encontrado', 404));
    }
    const curso = await cursosService.buscarPorId(id);
    if (!curso) return next(new AppError('Curso no encontrado', 404));
    req.curso = curso;
    return next();
  } catch (error) {
    return next(error);
  }
}

/**
 * El curso debe pertenencer al tutor autenticado (403 en caso contrario).
 * Requiere authMiddleware + cargarCurso antes en la cadena.
 */
function requerirDuenoDelCurso(req, res, next) {
  if (!req.user || !req.curso) {
    return next(new AppError('Autenticación requerida', 401));
  }
  if (req.curso.id_tutor !== req.user.id) {
    return next(new AppError('No tiene permisos sobre este curso', 403));
  }
  return next();
}

/**
 * Acceso a las lecciones de un curso: dueño, ADMIN o ESTUDIANTE inscrito.
 * Requiere authMiddleware + cargarCurso antes en la cadena.
 */
async function requerirAccesoAlCurso(req, res, next) {
  try {
    if (!req.user || !req.curso) {
      return next(new AppError('Autenticación requerida', 401));
    }
    if (req.user.rol === 'ADMIN' || req.curso.id_tutor === req.user.id) {
      return next();
    }
    if (req.user.rol === 'ESTUDIANTE') {
      const inscrito = await inscripcionesService.estaInscrito(
        req.curso.id,
        req.user.id
      );
      if (inscrito) return next();
    }
    return next(
      new AppError('No tiene acceso a las lecciones de este curso', 403)
    );
  } catch (error) {
    return next(error);
  }
}

module.exports = { cargarCurso, requerirDuenoDelCurso, requerirAccesoAlCurso };
