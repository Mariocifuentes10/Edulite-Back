/**
 * modulos/lecciones/lecciones.controller.js
 * Controlador de lecciones. El acceso (dueño, inscrito o admin) ya fue
 * verificado por los middlewares de la cadena de rutas.
 */
const leccionesService = require('./lecciones.service');
const AppError = require('../../utils/app-error');
const { ok } = require('../../utils/respuesta');

/**
 * GET /api/cursos/:id/lecciones — lista liviana (sin contenido).
 */
async function listarPorCurso(req, res) {
  const lecciones = await leccionesService.listarPorCurso(req.curso.id);
  return ok(res, { lecciones });
}

/**
 * GET /api/lecciones/:id — lección completa CON contenido (acceso verificado).
 */
async function obtener(req, res) {
  return ok(res, { leccion: req.leccion });
}

/**
 * POST /api/cursos/:id/lecciones — crea una lección (curso ya verificado como propio).
 * El orden debe estar libre en el curso (409).
 */
async function crear(req, res) {
  await leccionesService.verificarOrdenLibre(
    req.curso.id,
    req.body.orden
  );

  const leccion = await leccionesService.crear({
    id_curso: req.curso.id,
    orden: req.body.orden,
    titulo: req.body.titulo,
    contenido: req.body.contenido || '',
  });

  return ok(res, { leccion }, 'Lección creada', 201);
}

/**
 * PATCH /api/cursos/:id/lecciones/:idLeccion — edita si la lección pertenece al curso.
 */
async function actualizar(req, res) {
  const idLeccion = Number(req.params.idLeccion);
  const leccion = await leccionesService.buscarPorCursoYId(
    req.curso.id,
    idLeccion
  );
  if (!leccion) {
    throw new AppError('Lección no encontrada', 404);
  }

  if (req.body.orden !== undefined) {
    await leccionesService.verificarOrdenLibre(
      req.curso.id,
      req.body.orden,
      leccion.id
    );
  }

  const actualizada = await leccionesService.actualizar(leccion.id, req.body);
  return ok(res, { leccion: actualizada }, 'Lección actualizada');
}

/**
 * DELETE /api/cursos/:id/lecciones/:idLeccion — elimina si la lección pertenece al curso.
 */
async function eliminar(req, res) {
  const idLeccion = Number(req.params.idLeccion);
  const leccion = await leccionesService.buscarPorCursoYId(
    req.curso.id,
    idLeccion
  );
  if (!leccion) {
    throw new AppError('Lección no encontrada', 404);
  }

  await leccionesService.eliminar(leccion.id);
  return ok(res, null, 'Lección eliminada');
}

module.exports = { listarPorCurso, obtener, crear, actualizar, eliminar };
