/**
 * utils/porcentaje.js
 * ÚNICO lugar del backend donde se define la fórmula del porcentaje:
 *   100 * aciertos / total, redondeado a entero (0-100), y 0 si no hay filas.
 * Se expresa como expresión SQL para que todos los porcentajes (avance y
 * precisión) se calculen con agregación en la base: back y front muestran
 * siempre el mismo número y nadie recalcula en JavaScript.
 */

/**
 * Expresión SQL de porcentaje para un COUNT(*) agregado.
 *
 * @param {string} condicion - Expresión booleana interna que marca el caso
 *                             favorable. SIEMPRE una constante del código
 *                             (ej: 'p.completada', 'r.correcta'); jamás entra
 *                             desde el cliente.
 * @returns {string} expresión SQL lista para usar en un SELECT agregado
 */
function sqlPorcentaje(condicion) {
  return (
    'COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE ' +
    condicion +
    ') / NULLIF(COUNT(*), 0)), 0)::int'
  );
}

module.exports = { sqlPorcentaje };
