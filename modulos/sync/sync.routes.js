/**
 * modulos/sync/sync.routes.js
 * Rutas del módulo sync (montado en /api/sync).
 */
const { Router } = require('express');

const asyncHandler = require('../../utils/async-handler');
const { authMiddleware, permitirRoles } = require('../../middlewares/auth.middleware');
const validar = require('../../middlewares/validar.middleware');
const { validarSincronizacion, LIMITE_ITEMS } = require('./sync.validators');
const syncController = require('./sync.controller');

const router = Router();

/**
 * @swagger
 * /sync:
 *   post:
 *     tags: [Sync]
 *     summary: Sincroniza un lote offline de progreso y respuestas (ESTUDIANTE)
 *     description: >
 *       Recibe hasta 200 ítems con idCliente (UUID v4 generado en el navegador)
 *       y creadoEn (fecha ISO-8601 del cliente, no puede ser futura). Ítems de
 *       tipo PROGRESO ({ idLeccion, completada }) o RESPUESTA ({ idEvaluacion,
 *       respuesta }); la calificación se calcula SIEMPRE en el servidor.
 *       Idempotente: reenviar el mismo lote no duplica nada (ON CONFLICT en
 *       progreso y en resultados.id_cliente). Un ítem inválido NO tumba el
 *       lote: se responde 200 con ese ítem en "rechazados" y su motivo, y el
 *       resto se acepta. Cada ítem se procesa con transacción individual.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 200
 *                 items:
 *                   type: object
 *                   required: [tipo, idCliente, creadoEn]
 *                   properties:
 *                     tipo: { type: string, enum: [PROGRESO, RESPUESTA] }
 *                     idCliente: { type: string, format: uuid }
 *                     creadoEn: { type: string, format: date-time }
 *                     idLeccion: { type: integer, minimum: 1 }
 *                     completada: { type: boolean }
 *                     idEvaluacion: { type: integer, minimum: 1 }
 *                     respuesta: { type: string, maxLength: 500 }
 *                 example:
 *                   - tipo: PROGRESO
 *                     idCliente: 3f1a9c0e-6f4b-4a52-9d21-1c8e5b7a2d90
 *                     creadoEn: '2026-10-08T12:00:00.000Z'
 *                     idLeccion: 1
 *                     completada: true
 *                   - tipo: RESPUESTA
 *                     idCliente: 8b6d2f14-9c3a-4e7b-b0d5-2a4f6e8c1a33
 *                     creadoEn: '2026-10-08T12:01:00.000Z'
 *                     idEvaluacion: 1
 *                     respuesta: '19'
 *     responses:
 *       '200':
 *         description: Lote procesado (aceptados y rechazados ítem a ítem)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/ResultadoSync' }
 *                 message: { type: string }
 *       '400': { description: items ausente, no es array o tiene más de 200 elementos }
 *       '401': { description: Sin token }
 *       '403': { description: Rol distinto de ESTUDIANTE }
 */
router.post(
  '/',
  authMiddleware,
  permitirRoles('ESTUDIANTE'),
  validarSincronizacion,
  validar,
  asyncHandler(syncController.sincronizar)
);

module.exports = router;
