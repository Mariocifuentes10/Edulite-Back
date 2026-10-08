/**
 * utils/uuid.js
 * Validación compartida de UUID v4: el ÚNICO formato de idCliente que
 * acepta la API. Se genera en el navegador y garantiza la idempotencia
 * del modo offline (Sprint 3 responder / Sprint 4 sync).
 */
const REGEX_UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * ¿El valor es un UUID v4 bien formado?
 * @param {any} valor
 * @returns {boolean}
 */
function esUuidV4(valor) {
  return typeof valor === 'string' && REGEX_UUID_V4.test(valor);
}

module.exports = { esUuidV4 };
