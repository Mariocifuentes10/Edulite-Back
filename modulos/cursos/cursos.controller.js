/**
 * modulos/cursos/cursos.controller.js
 * Controlador de cursos: orquesta middlewares de acceso → service → respuesta.
 * Sin SQL ni reglas de negocio aquí.
 */
const cursosService = require('./cursos.service');
const leccionesService = require('../lecciones/lecciones.service');
const AppError = require('../../utils/app-error');
const { ok } = require('../../utils/respuesta');

/**
 * GET /api/cursos — catálogo público paginado.
 */
async function listar(req, res) {
  const pagina = Number(req.query.pagina) || 1;
  const limite = Number(req.query.limite) || 10;

  const { cursos, total } = await cursosService.listarCatalogo({
    nivel: req.query.nivel || null,
    q: req.query.q || null,
    pagina,
    limite,
  });

  return ok(res, {
    cursos,
    pagina,
    limite,
    total,
    totalPaginas: Math.max(Math.ceil(total / limite), 1),
  });
}

/**
 * GET /api/cursos/:id — detalle público. Los borradores solo los ven
 * su dueño o un ADMIN; para el resto respondemos 404 (no revelar existencia).
 * La lista de lecciones va SIN contenido.
 */
async function detalle(req, res) {
  const esDueno = req.user && req.user.id === req.curso.id_tutor;
  const esAdmin = req.user && req.user.rol === 'ADMIN';

  if (!req.curso.publicado && !esDueno && !esAdmin) {
    throw new AppError('Curso no encontrado', 404);
  }

  const lecciones = await leccionesService.listarPorCurso(req.curso.id);

  return ok(res, {
    curso: req.curso,
    lecciones,
  });
}

/**
 * POST /api/cursos — crea un curso en borrador (rol TUTOR).
 */
async function crear(req, res) {
  const curso = await cursosService.crear({
    titulo: req.body.titulo,
    descripcion: req.body.descripcion || null,
    nivel: req.body.nivel || null,
    id_tutor: req.user.id,
  });

  return ok(res, { curso }, 'Curso creado. Publíquelo cuando esté listo.', 201);
}

/**
 * PATCH /api/cursos/:id — actualiza el propio curso (ya validado por
 * requerirDuenoDelCurso).
 */
async function actualizar(req, res) {
  const curso = await cursosService.actualizar(req.curso.id, req.body);
  return ok(res, { curso }, 'Curso actualizado');
}

/**
 * DELETE /api/cursos/:id — elimina el propio curso (borra lecciones en cascada).
 */
async function eliminar(req, res) {
  await cursosService.eliminar(req.curso.id);
  return ok(res, null, 'Curso eliminado');
}

module.exports = { listar, detalle, crear, actualizar, eliminar };
