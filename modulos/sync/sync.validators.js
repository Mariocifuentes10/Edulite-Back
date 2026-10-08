/**
 * modulos/sync/sync.validators.js
 * Validación de NIVEL DE LOTE (express-validator). Solo valida la envoltura:
 * items debe ser un arreglo de 1 a 200 elementos. La validación de cada
 * ítem NO puede vivir aquí: un ítem inválido no debe tumbar el lote, así
 * que se hace ítem por ítem en sync.service (Fase A: forma / Fase B: base).
 */
const { body } = require('express-validator');

const LIMITE_ITEMS = 200;

const validarSincronizacion = [
  body('items')
    .isArray({ min: 1, max: LIMITE_ITEMS })
    .withMessage(`items debe ser un arreglo con entre 1 y ${LIMITE_ITEMS} elementos`),
];

module.exports = { validarSincronizacion, LIMITE_ITEMS };
