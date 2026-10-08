/**
 * modulos/inscripciones/inscripciones.controller.js
 * Controlador de inscripciones. Solo ESTUDIANTE (validado en la ruta).
 */
const inscripcionesService = require('./inscripciones.service');
const AppError = require('../../utils/app-error');
const { ok } = require('../../utils/respuesta');

/**
 * POST /api/cursos/:id/inscribirse — idempotente.
 * 201 si se creó la inscripción; 200 si ya existía (nunca error ni duplicado).
 */
async function inscribirse(req, res) {
  if (!req.curso.publicado) {
    throw new AppError(
      'No se puede inscribir en un curso que no está publicado',
      409
    );
  }

  const { insertada } = await inscripcionesService.inscribirse(
    req.curso.id,
    req.user.id
  );

  const data = { id_curso: req.curso.id, id_estudiante: req.user.id };

  if (insertada) {
    return ok(res, data, 'Inscripción realizada', 201);
  }
  return ok(res, data, 'Ya estaba inscrito en este curso', 200);
}

module.exports = { inscribirse };
