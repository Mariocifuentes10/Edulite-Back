/**
 * modulos/progreso/progreso.controller.js
 * Controlador de progreso. El porcentaje NO se calcula aquí: se toma
 * tal cual del SQL de progreso.service (único lugar con la fórmula).
 * La vista /api/estudiantes/me/progreso vive en el módulo estudiantes
 * y también delega en progreso.service.
 */
const progresoService = require('./progreso.service');
const { ok } = require('../../utils/respuesta');

/**
 * POST /api/progreso — registra una lección como completada o pendiente
 * (ESTUDIANTE inscrito en el curso; idempotente).
 */
async function registrar(req, res) {
  const registro = await progresoService.registrar({
    idUsuario: req.user.id,
    idLeccion: req.body.idLeccion,
    completada: req.body.completada,
  });
  return ok(res, { progreso: registro }, 'Progreso registrado');
}

module.exports = { registrar };
