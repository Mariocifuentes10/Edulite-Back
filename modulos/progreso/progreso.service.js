/**
 * modulos/progreso/progreso.service.js
 * SQL del módulo progreso. Idempotencia garantizada por la PK
 * (id_usuario, id_leccion) + ON CONFLICT ... DO UPDATE.
 *
 * ★ ÚNICO LUGAR del backend donde se calcula el porcentaje de AVANCE.
 *   La fórmula vive en utils/porcentaje.js y aquí se aplica SIEMPRE con
 *   agregación SQL (SQL_PORCENTAJE_AVANCE). Ni el controller, ni los otros
 *   módulos, ni el frontend vuelven a calcularlo: consumen este número.
 */
const { query } = require('../../config/db');
const AppError = require('../../utils/app-error');
const { sqlPorcentaje } = require('../../utils/porcentaje');

/** Expresión única del porcentaje de avance (exige alias de tabla `p` = progreso). */
const SQL_PORCENTAJE_AVANCE = sqlPorcentaje('p.completada');

/**
 * Avance del estudiante en un curso, calculado con una sola agregación SQL.
 * @param {number} idEstudiante
 * @param {number} idCurso
 * @returns {Promise<{ completadas: number, totales: number, porcentaje: number }>}
 */
async function obtenerAvance(idEstudiante, idCurso) {
  const { rows } = await query(
    `SELECT (COUNT(*) FILTER (WHERE p.completada))::int AS completadas,
            COUNT(*)::int AS totales,
            ${SQL_PORCENTAJE_AVANCE} AS porcentaje
     FROM lecciones l
     LEFT JOIN progreso p ON p.id_leccion = l.id AND p.id_usuario = $1
     WHERE l.id_curso = $2`,
    [idEstudiante, idCurso]
  );
  return rows[0];
}

/**
 * Avance global del estudiante (todos los cursos inscritos), con la MISMA
 * fórmula y la misma expresión SQL que obtenerAvance.
 * @param {number} idEstudiante
 * @returns {Promise<{ completadas: number, totales: number, porcentaje: number }>}
 */
async function obtenerAvanceGlobal(idEstudiante) {
  const { rows } = await query(
    `SELECT (COUNT(*) FILTER (WHERE p.completada))::int AS completadas,
            COUNT(*)::int AS totales,
            ${SQL_PORCENTAJE_AVANCE} AS porcentaje
     FROM inscripciones i
     INNER JOIN lecciones l ON l.id_curso = i.id_curso
     LEFT JOIN progreso p ON p.id_leccion = l.id AND p.id_usuario = i.id_estudiante
     WHERE i.id_estudiante = $1`,
    [idEstudiante]
  );
  return rows[0];
}

/**
 * Lecciones de un curso con su estado de completado.
 * @param {number} idEstudiante
 * @param {number} idCurso
 * @returns {Promise<Object[]>}
 */
async function listarLecciones(idEstudiante, idCurso) {
  const { rows } = await query(
    `SELECT l.id, l.orden, l.titulo, COALESCE(p.completada, FALSE) AS completada
     FROM lecciones l
     LEFT JOIN progreso p ON p.id_leccion = l.id AND p.id_usuario = $1
     WHERE l.id_curso = $2
     ORDER BY l.orden ASC`,
    [idEstudiante, idCurso]
  );
  return rows;
}

/**
 * Progreso del estudiante en un curso (vista de /api/estudiantes/me/progreso).
 * @param {number} idEstudiante
 * @param {number} idCurso
 * @returns {Promise<Object>} { curso, lecciones, completadas, totales, porcentaje }
 */
async function obtenerProgresoCurso(idEstudiante, idCurso) {
  const { rows: cursos } = await query(
    'SELECT id, titulo FROM cursos WHERE id = $1',
    [idCurso]
  );
  if (!cursos[0]) throw new AppError('Curso no encontrado', 404);

  const { rows: inscripciones } = await query(
    'SELECT 1 FROM inscripciones WHERE id_curso = $1 AND id_estudiante = $2',
    [idCurso, idEstudiante]
  );
  if (!inscripciones[0]) {
    throw new AppError('No está inscrito en este curso', 403);
  }

  const [avance, lecciones] = await Promise.all([
    obtenerAvance(idEstudiante, idCurso),
    listarLecciones(idEstudiante, idCurso),
  ]);

  return {
    curso: cursos[0],
    lecciones,
    completadas: avance.completadas,
    totales: avance.totales,
    porcentaje: avance.porcentaje,
  };
}

/**
 * Registra (o actualiza) el progreso de una lección. Idempotente: reenviar
 * el mismo par usuario+lección no duplica filas y refresca actualizado_en.
 *
 * @param {Object} parametros - { idUsuario, idLeccion, completada, actualizadoEn?, ejecutar? }
 * @param {Date} [parametros.actualizadoEn] - fecha del cliente (sync offline,
 *   se valida que no sea futura); por defecto now() del servidor.
 * @param {Function} [parametros.ejecutar] - variante de query para correr
 *   dentro de una transacción (sync: transacción por ítem). Por defecto el pool.
 * @returns {Promise<Object>} fila de progreso
 * @throws {AppError} 404 si la lección no existe; 403 si no está inscrito
 */
async function registrar({
  idUsuario,
  idLeccion,
  completada,
  actualizadoEn = null,
  ejecutar = query,
}) {
  const { rows: lecciones } = await ejecutar(
    'SELECT id FROM lecciones WHERE id = $1',
    [idLeccion]
  );
  if (!lecciones[0]) throw new AppError('Lección no encontrada', 404);

  const { rows: inscripciones } = await ejecutar(
    `SELECT 1 FROM lecciones l
     WHERE l.id = $1
       AND EXISTS (
         SELECT 1 FROM inscripciones i
         WHERE i.id_curso = l.id_curso AND i.id_estudiante = $2
       )`,
    [idLeccion, idUsuario]
  );
  if (!inscripciones[0]) {
    throw new AppError('No está inscrito en el curso de esta lección', 403);
  }

  const { rows } = await ejecutar(
    `INSERT INTO progreso (id_usuario, id_leccion, completada, actualizado_en)
     VALUES ($1, $2, $3, COALESCE($4::timestamptz, now()))
     ON CONFLICT (id_usuario, id_leccion)
     DO UPDATE SET completada = EXCLUDED.completada,
                   actualizado_en = EXCLUDED.actualizado_en
     RETURNING id_usuario, id_leccion, completada, actualizado_en`,
    [idUsuario, idLeccion, completada, actualizadoEn]
  );
  return rows[0];
}

module.exports = {
  SQL_PORCENTAJE_AVANCE,
  obtenerAvance,
  obtenerAvanceGlobal,
  listarLecciones,
  obtenerProgresoCurso,
  registrar,
};
