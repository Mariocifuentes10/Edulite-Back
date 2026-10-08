/**
 * modulos/sync/sync.service.js
 * Sincronización offline (Sprint 4). Un lote de ítems PROGRESO/RESPUESTA
 * se procesa ÍTEM A ÍTEM con TRANSACCIÓN POR ÍTEM (no por lote):
 *
 *   • El contrato es de aceptación PARCIAL: un ítem inválido va a
 *     "rechazados" con su motivo y el resto se acepta; una transacción de
 *     lote sería todo-o-nada, lo contrario de lo pedido.
 *   • En Postgres, si una sentencia falla dentro de un BEGIN, la transacción
 *     queda aborted y todo lo siguiente falla; seguir dentro del mismo BEGIN
 *     exigiría un SAVEPOINT por ítem (complejidad extra sin beneficio).
 *   • No hay invariantes entre ítems y cada escritura es idempotente
 *     (ON CONFLICT en progreso y en resultados.id_cliente): si el proceso
 *     muere a mitad de lote, el cliente reenvía y converge sin duplicar.
 *
 * Fase A (forma, SIN base): tipo, idCliente UUID v4, creadoEn ISO válida y
 * no futura, y el payload propio de cada tipo. Fase B (semántica, DENTRO de
 * la transacción): lección/evaluación existente, inscripción, idCliente de
 * otro usuario. Cualquier AppError se captura, se hace ROLLBACK de ESE ítem
 * y se continúa con el siguiente.
 */
const { pool } = require('../../config/db');
const AppError = require('../../utils/app-error');
const { esUuidV4 } = require('../../utils/uuid');
const progresoService = require('../progreso/progreso.service');
const evaluacionesService = require('../evaluaciones/evaluaciones.service');

/** Tolerancia para desfases de reloj entre el navegador y el servidor (ms). */
const TOLERANCIA_FUTURO_MS = 2 * 60 * 1000;

/**
 * Fase A: validación de forma de un ítem. NO toca la base de datos.
 * @param {any} item
 * @returns {string|null} motivo de rechazo o null si la forma es válida
 */
function validarForma(item) {
  if (typeof item !== 'object' || item === null || Array.isArray(item)) {
    return 'El ítem debe ser un objeto';
  }
  if (item.tipo !== 'PROGRESO' && item.tipo !== 'RESPUESTA') {
    return 'tipo debe ser PROGRESO o RESPUESTA';
  }
  if (!esUuidV4(item.idCliente)) {
    return 'idCliente debe ser un UUID v4';
  }
  if (typeof item.creadoEn !== 'string') {
    return 'creadoEn es obligatoria';
  }
  const creadoEn = new Date(item.creadoEn);
  if (Number.isNaN(creadoEn.getTime())) {
    return 'creadoEn debe ser una fecha ISO-8601 válida';
  }
  if (creadoEn.getTime() > Date.now() + TOLERANCIA_FUTURO_MS) {
    return 'creadoEn no puede ser futura';
  }

  if (item.tipo === 'PROGRESO') {
    if (!Number.isInteger(item.idLeccion) || item.idLeccion < 1) {
      return 'idLeccion debe ser un entero >= 1';
    }
    if (typeof item.completada !== 'boolean') {
      return 'completada debe ser true o false';
    }
  } else {
    if (!Number.isInteger(item.idEvaluacion) || item.idEvaluacion < 1) {
      return 'idEvaluacion debe ser un entero >= 1';
    }
    if (typeof item.respuesta !== 'string' || item.respuesta.trim() === '') {
      return 'respuesta es obligatoria';
    }
    if (item.respuesta.length > 500) {
      return 'respuesta no puede superar 500 caracteres';
    }
  }
  return null;
}

/**
 * Ejecuta fn(ejecutar) dentro de una transacción de UN solo ítem:
 * COMMIT si todo va bien, ROLLBACK si fn lanza (cualquier error).
 * @param {Function} fn - recibe la función query de la conexión transaccional
 */
async function conTransaccionPorItem(fn) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const ejecutar = (sql, params) => cliente.query(sql, params);
    await fn(ejecutar);
    await cliente.query('COMMIT');
  } catch (error) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    cliente.release();
  }
}

/**
 * Fase B: validación semántica + escritura de UN ítem, dentro de la
 * transacción del ítem. Lanza AppError si el ítem es rechazable.
 *
 * @param {Object} item - ítem con forma ya validada
 * @param {number} idUsuario - estudiante autenticado
 * @param {Function} ejecutar - query de la conexión transaccional
 */
async function procesarItem(item, idUsuario, ejecutar) {
  const fechaCliente = new Date(item.creadoEn);

  if (item.tipo === 'PROGRESO') {
    // valida lección (404) e inscripción (403) antes de escribir
    await progresoService.registrar({
      idUsuario,
      idLeccion: item.idLeccion,
      completada: item.completada,
      actualizadoEn: fechaCliente,
      ejecutar,
    });
    return;
  }

  // RESPUESTA: se califica SIEMPRE en el servidor con la fila completa.
  const evaluacion = await evaluacionesService.buscarPorId(
    item.idEvaluacion,
    ejecutar
  );
  if (!evaluacion) {
    throw new AppError('Evaluación no encontrada', 404);
  }
  const { rows } = await ejecutar(
    'SELECT 1 FROM inscripciones WHERE id_curso = $1 AND id_estudiante = $2',
    [evaluacion.id_curso, idUsuario]
  );
  if (!rows[0]) {
    throw new AppError('No está inscrito en el curso de esta evaluación', 403);
  }
  await evaluacionesService.registrarRespuesta({
    evaluacion,
    idUsuario,
    idCliente: item.idCliente,
    respuesta: item.respuesta,
    respondidaEn: fechaCliente,
    ejecutar,
  });
}

/**
 * Procesa un lote completo de forma secuencial (sin paralelismo: los ítems
 * comparten el mismo estudiante y el pool es de bajo consumo).
 *
 * @param {Object[]} items - lote ya validado como arreglo (1..200) por express-validator
 * @param {number} idUsuario - estudiante autenticado
 * @returns {Promise<{ aceptados: string[], rechazados: Object[] }>}
 */
async function procesarLote(items, idUsuario) {
  const aceptados = [];
  const rechazados = [];
  const vistos = new Set();

  for (const item of items) {
    const idCliente =
      item && typeof item === 'object' && item.idCliente !== undefined
        ? item.idCliente
        : null;

    // Fase A: forma (sin transacción, sin base)
    const motivoForma = validarForma(item);
    if (motivoForma) {
      rechazados.push({ idCliente, motivo: motivoForma });
      continue;
    }

    // Un mismo idCliente dos veces en el lote: solo procesa el primero.
    if (vistos.has(item.idCliente)) {
      rechazados.push({ idCliente: item.idCliente, motivo: 'idCliente repetido en el lote' });
      continue;
    }
    vistos.add(item.idCliente);

    // Fase B: semántica + escritura con transacción POR ÍTEM
    try {
      await conTransaccionPorItem((ejecutar) =>
        procesarItem(item, idUsuario, ejecutar)
      );
      aceptados.push(item.idCliente);
    } catch (error) {
      if (error.esAppError) {
        rechazados.push({ idCliente: item.idCliente, motivo: error.message });
      } else {
        // Error inesperado: se aísla a este ítem y no tumbar el lote.
        console.error('[sync] error inesperado procesando un ítem:', error);
        rechazados.push({
          idCliente: item.idCliente,
          motivo: 'No se pudo procesar el ítem',
        });
      }
    }
  }

  return { aceptados, rechazados };
}

module.exports = { procesarLote, validarForma };
