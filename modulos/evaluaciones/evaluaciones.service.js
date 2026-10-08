/**
 * modulos/evaluaciones/evaluaciones.service.js
 * SQL del módulo evaluaciones. Reglas clave:
 *   • Ninguna función destinada al cliente SITÚA la columna respuesta_correcta
 *     (solo buscarPorId la trae, exclusivamente para calificar en el servidor).
 *   • registrarRespuesta es idempotente: ON CONFLICT (id_cliente) DO NOTHING.
 */
const { query } = require('../../config/db');
const AppError = require('../../utils/app-error');

/** Columnas seguras para entregar al cliente (NUNCA respuesta_correcta). */
const COLUMNAS_PUBLICAS =
  'e.id, e.id_leccion, e.pregunta, e.opciones, e.creado_en';

/** Columnas que un cliente puede actualizar vía PATCH. */
const COLUMNAS_ACTUALIZABLES = ['pregunta', 'opciones', 'respuesta_correcta'];

function esIdValido(id) {
  return Number.isInteger(id) && id >= 1;
}

/**
 * Evaluaciones de una lección SIN respuesta_correcta (para estudiantes).
 * @param {number} idLeccion
 * @returns {Promise<Object[]>}
 */
async function listarPorLeccion(idLeccion) {
  const { rows } = await query(
    `SELECT ${COLUMNAS_PUBLICAS}
     FROM evaluaciones e
     WHERE e.id_leccion = $1
     ORDER BY e.id ASC`,
    [idLeccion]
  );
  return rows;
}

/**
 * Evaluación por id CON respuesta_correcta (y con id_curso de su lección,
 * para verificar inscripción). Uso INTERNO: solo para calificar en el
 * servidor; jamás se devuelve su contenido al cliente.
 *
 * @param {number} id
 * @param {Function} [ejecutar] - variante de query para correr dentro de
 *   una transacción (sync). Por defecto el pool.
 * @returns {Promise<Object|null>}
 */
async function buscarPorId(id, ejecutar = query) {
  if (!esIdValido(id)) return null;
  const { rows } = await ejecutar(
    `SELECT e.id, e.id_leccion, e.pregunta, e.opciones, e.respuesta_correcta,
            e.creado_en, l.id_curso
     FROM evaluaciones e
     INNER JOIN lecciones l ON l.id = e.id_leccion
     WHERE e.id = $1`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Evaluación que pertenece a la lección indicada (para rutas anidadas).
 * @param {number} idLeccion
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
async function buscarPorLeccionYId(idLeccion, id) {
  if (!esIdValido(id)) return null;
  const { rows } = await query(
    `SELECT ${COLUMNAS_PUBLICAS}
     FROM evaluaciones e
     WHERE e.id = $1 AND e.id_leccion = $2`,
    [id, idLeccion]
  );
  return rows[0] || null;
}

/**
 * Crea una evaluación. La respuesta correcta DEBE estar en opciones
 * (garantizan el validador y los CHECK de la tabla).
 * @param {Object} datos - { id_leccion, pregunta, opciones, respuesta_correcta }
 * @returns {Promise<Object>} evaluación pública (sin respuesta_correcta)
 */
async function crear({ id_leccion, pregunta, opciones, respuesta_correcta }) {
  const { rows } = await query(
    `INSERT INTO evaluaciones (id_leccion, pregunta, opciones, respuesta_correcta)
     VALUES ($1, $2, $3::jsonb, $4)
     RETURNING id, id_leccion, pregunta, opciones, creado_en`,
    [id_leccion, pregunta, JSON.stringify(opciones), respuesta_correcta]
  );
  return rows[0];
}

/**
 * Actualiza una evaluación de la lección indicada (lista blanca).
 * Si cambian las opciones sin reenviar la respuesta correcta, se revalida
 * que la respuesta vigente siga dentro del nuevo arreglo de opciones.
 *
 * @param {number} idLeccion
 * @param {number} id
 * @param {Object} campos - Subconjunto de { pregunta, opciones, respuesta_correcta }
 * @returns {Promise<Object>} evaluación pública (sin respuesta_correcta)
 */
async function actualizarPorLeccion(idLeccion, id, campos) {
  const existente = await buscarPorLeccionYId(idLeccion, id);
  if (!existente) throw new AppError('Evaluación no encontrada', 404);

  const opciones =
    campos.opciones !== undefined ? campos.opciones : existente.opciones;
  const respuesta_correcta =
    campos.respuesta_correcta !== undefined
      ? campos.respuesta_correcta
      : existente.respuesta_correcta;

  if (!Array.isArray(opciones) || !opciones.includes(respuesta_correcta)) {
    throw new AppError(
      'La respuesta_correcta debe estar dentro de las opciones',
      400
    );
  }

  const sets = [];
  const parametros = [];

  for (const columna of COLUMNAS_ACTUALIZABLES) {
    if (campos[columna] === undefined) continue;
    const valor =
      columna === 'opciones'
        ? JSON.stringify(opciones)
        : columna === 'respuesta_correcta'
          ? respuesta_correcta
          : campos[columna];
    parametros.push(valor);
    sets.push(`${columna} = $${parametros.length}`);
  }

  if (sets.length === 0) {
    throw new AppError('Debe enviar al menos un campo a actualizar', 400);
  }

  parametros.push(existente.id);

  const { rows } = await query(
    `UPDATE evaluaciones SET ${sets.join(', ')}
     WHERE id = $${parametros.length}
     RETURNING id, id_leccion, pregunta, opciones, creado_en`,
    parametros
  );
  return rows[0];
}

/**
 * Elimina una evaluación de la lección indicada.
 * @param {number} idLeccion
 * @param {number} id
 * @returns {Promise<void>}
 */
async function eliminarPorLeccion(idLeccion, id) {
  const existente = await buscarPorLeccionYId(idLeccion, id);
  if (!existente) throw new AppError('Evaluación no encontrada', 404);
  await query('DELETE FROM evaluaciones WHERE id = $1', [existente.id]);
}

/**
 * Califica en el servidor y guarda el resultado de forma idempotente.
 * Reenviar el mismo idCliente NUNCA crea una segunda fila: se responde con
 * la calificación ya registrada (ON CONFLICT (id_cliente) DO NOTHING).
 *
 * @param {Object} parametros
 * @param {Object} parametros.evaluacion - fila completa (con respuesta_correcta, uso interno)
 * @param {number} parametros.idUsuario
 * @param {string} parametros.idCliente - UUID v4 del cliente
 * @param {string} parametros.respuesta - texto enviado por el estudiante
 * @param {Date} [parametros.respondidaEn] - fecha del cliente (sync offline,
 *   se valida que no sea futura); por defecto now() del servidor.
 * @param {Function} [parametros.ejecutar] - variante de query para correr
 *   dentro de una transacción (sync: transacción por ítem). Por defecto el pool.
 * @returns {Promise<{ correcta: boolean, duplicado: boolean }>}
 */
async function registrarRespuesta({
  evaluacion,
  idUsuario,
  idCliente,
  respuesta,
  respondidaEn = null,
  ejecutar = query,
}) {
  const correcta = respuesta === evaluacion.respuesta_correcta;

  const { rowCount } = await ejecutar(
    `INSERT INTO resultados
       (id_evaluacion, id_usuario, id_cliente, respuesta, correcta, respondida_en)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, now()))
     ON CONFLICT (id_cliente) DO NOTHING`,
    [evaluacion.id, idUsuario, idCliente, respuesta, correcta, respondidaEn]
  );

  if (rowCount === 1) return { correcta, duplicado: false };

  // El idCliente ya estaba registrado: se responde con la calificación original.
  const { rows } = await ejecutar(
    'SELECT id_usuario, correcta FROM resultados WHERE id_cliente = $1',
    [idCliente]
  );
  const existente = rows[0];
  if (!existente) {
    throw new AppError('No se pudo registrar la respuesta', 500);
  }
  if (existente.id_usuario !== idUsuario) {
    throw new AppError('idCliente ya registrado por otro usuario', 409);
  }
  return { correcta: existente.correcta, duplicado: true };
}

module.exports = {
  listarPorLeccion,
  buscarPorId,
  buscarPorLeccionYId,
  crear,
  actualizarPorLeccion,
  eliminarPorLeccion,
  registrarRespuesta,
};
