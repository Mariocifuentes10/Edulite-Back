/**
 * modulos/evaluaciones/evaluaciones.controller.js
 * Controlador de evaluaciones. El acceso (tutor dueño / estudiante inscrito)
 * ya fue verificado por los middlewares de la cadena de rutas.
 */
const evaluacionesService = require('./evaluaciones.service');
const { ok } = require('../../utils/respuesta');

/**
 * POST /api/lecciones/:id/evaluaciones — crea una pregunta (TUTOR dueño).
 * La respuesta nunca se devuelve al cliente.
 */
async function crear(req, res) {
  const evaluacion = await evaluacionesService.crear({
    id_leccion: req.leccion.id,
    pregunta: req.body.pregunta,
    opciones: req.body.opciones,
    respuesta_correcta: req.body.respuesta_correcta,
  });
  return ok(res, { evaluacion }, 'Evaluación creada', 201);
}

/**
 * GET /api/lecciones/:id/evaluaciones — lista SIN respuesta_correcta.
 */
async function listar(req, res) {
  const evaluaciones = await evaluacionesService.listarPorLeccion(req.leccion.id);
  return ok(res, { evaluaciones });
}

/**
 * PATCH /api/lecciones/:id/evaluaciones/:idEvaluacion — edita (TUTOR dueño).
 */
async function actualizar(req, res) {
  const evaluacion = await evaluacionesService.actualizarPorLeccion(
    req.leccion.id,
    Number(req.params.idEvaluacion),
    req.body
  );
  return ok(res, { evaluacion }, 'Evaluación actualizada');
}

/**
 * DELETE /api/lecciones/:id/evaluaciones/:idEvaluacion — elimina (TUTOR dueño).
 */
async function eliminar(req, res) {
  await evaluacionesService.eliminarPorLeccion(
    req.leccion.id,
    Number(req.params.idEvaluacion)
  );
  return ok(res, null, 'Evaluación eliminada');
}

/**
 * POST /api/evaluaciones/:id/responder — califica en el servidor (ESTUDIANTE).
 * Idempotente por idCliente: la primera vez 201 y las siguientes 200 con
 * la misma calificación original.
 */
async function responder(req, res) {
  const { correcta, duplicado } = await evaluacionesService.registrarRespuesta({
    evaluacion: req.evaluacion,
    idUsuario: req.user.id,
    idCliente: req.body.idCliente,
    respuesta: req.body.respuesta,
  });

  return ok(
    res,
    { correcta },
    duplicado ? 'Respuesta ya registrada' : 'Respuesta registrada',
    duplicado ? 200 : 201
  );
}

module.exports = { crear, listar, actualizar, eliminar, responder };
