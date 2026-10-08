/**
 * modulos/tutorias/tutorias.controller.js
 * Endpoints del módulo tutorias. Solo orquesta: valida permisos básicos de
 * rol y delega todo el SQL y las reglas de transición en tutorias.service.
 */
const tutoriasService = require('./tutorias.service');
const { ok } = require('../../utils/respuesta');

/**
 * POST /api/tutorias — el estudiante solicita una tutoría.
 */
async function crear(req, res) {
  const { idTutor, idCurso, fecha, tema } = req.body;
  const tutoria = await tutoriasService.crear({
    idEstudiante: req.user.id,
    idTutor,
    idCurso: idCurso ?? null,
    fecha,
    tema,
  });
  return ok(res, { tutoria }, 'Solicitud de tutoría creada', 201);
}

/**
 * GET /api/tutorias?estado=&pagina=&limite= — el estudiante ve las suyas,
 * el tutor ve las que le piden.
 */
async function listar(req, res) {
  const pagina = Number(req.query.pagina) || 1;
  const limite = Number(req.query.limite) || 10;
  const { tutorias, total } = await tutoriasService.listar({
    rol: req.user.rol,
    idUsuario: req.user.id,
    estado: req.query.estado || null,
    pagina,
    limite,
  });
  return ok(res, {
    tutorias,
    pagina,
    limite,
    total,
    totalPaginas: Math.max(Math.ceil(total / limite), 1),
  });
}

/**
 * PATCH /api/tutorias/:id/estado — cambio de estado con tabla de
 * transiciones; cualquier transición no permitida responde 409.
 */
async function cambiarEstado(req, res) {
  const tutoria = await tutoriasService.cambiarEstado({
    idTutoria: req.params.id,
    rol: req.user.rol,
    idUsuario: req.user.id,
    nuevoEstado: req.body.estado,
  });
  return ok(res, { tutoria }, 'Estado de la tutoría actualizado');
}

module.exports = { crear, listar, cambiarEstado };
