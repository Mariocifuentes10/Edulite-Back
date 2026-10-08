/**
 * modulos/sync/sync.controller.js
 * Controlador de sincronización offline. Todo el trabajo (validación por
 * ítem, transacciones, idempotencia) vive en sync.service.
 */
const syncService = require('./sync.service');
const { ok } = require('../../utils/respuesta');

/**
 * POST /api/sync — recibe un lote offline y lo procesa ítem a ítem.
 * Siempre responde 200: el resultado está en { aceptados, rechazados }.
 */
async function sincronizar(req, res) {
  const { aceptados, rechazados } = await syncService.procesarLote(
    req.body.items,
    req.user.id
  );
  return ok(res, { aceptados, rechazados }, 'Sincronización procesada');
}

module.exports = { sincronizar };
