/**
 * modulos/admin/admin.controller.js
 * Endpoints del panel de administración. Solo orquesta: valida reglas de
 * permisos y delega el SQL en admin.service / usuarios.service.
 */
const adminService = require('./admin.service');
const usuariosService = require('../usuarios/usuarios.service');
const AppError = require('../../utils/app-error');
const { ok } = require('../../utils/respuesta');

/**
 * GET /api/admin/usuarios?rol=&pagina=&limite= — lista paginada de usuarios
 * con filtro opcional por rol. Nunca incluye password_hash.
 */
async function listarUsuarios(req, res) {
  const pagina = Number(req.query.pagina) || 1;
  const limite = Number(req.query.limite) || 20;
  const rol = req.query.rol || null;
  const { usuarios, total } = await usuariosService.listar({
    rol,
    pagina,
    limite,
  });
  return ok(res, {
    usuarios,
    pagina,
    limite,
    total,
    totalPaginas: Math.max(Math.ceil(total / limite), 1),
  });
}

/**
 * PATCH /api/admin/usuarios/:id/activo — suspende (activo=false) o reactiva
 * (activo=true) una cuenta. Un admin no puede suspender su propia cuenta
 * (evita el auto-bloqueo del panel).
 */
async function cambiarActivo(req, res) {
  const id = Number(req.params.id);
  const { activo } = req.body;

  if (activo === false && id === req.user.id) {
    throw new AppError(
      'Un administrador no puede suspender su propia cuenta',
      400
    );
  }

  const usuario = await usuariosService.actualizarActivo(id, activo);
  if (!usuario) {
    throw new AppError('Usuario no encontrado', 404);
  }

  return ok(
    res,
    { usuario },
    activo ? 'Usuario activado' : 'Usuario suspendido'
  );
}

/**
 * GET /api/admin/estadisticas — métricas globales de la plataforma.
 */
async function estadisticas(req, res) {
  const datos = await adminService.estadisticas();
  return ok(res, datos);
}

module.exports = { listarUsuarios, cambiarActivo, estadisticas };
