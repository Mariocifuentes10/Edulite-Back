/**
 * modulos/estudiantes/estudiantes.service.js
 * SQL de las vistas "me" del estudiante. El porcentaje de AVANCE nunca se
 * calcula aquí: se delega en progreso.service (único lugar con la fórmula
 * de avance); solo se reutiliza utils/porcentaje.js para la precisión de
 * evaluaciones, que es otra métrica.
 */
const { query } = require('../../config/db');
const progresoService = require('../progreso/progreso.service');
const { sqlPorcentaje } = require('../../utils/porcentaje');

/**
 * Estadísticas del estudiante autenticado (sección 5.4 del documento de
 * arquitectura): avance, avance por curso, resultados de evaluaciones y
 * racha de días con actividad.
 *
 * @param {number} idEstudiante
 * @returns {Promise<Object>}
 */
async function estadisticas(idEstudiante) {
  const [avance, porCurso, evaluaciones, rachaDias] = await Promise.all([
    progresoService.obtenerAvanceGlobal(idEstudiante),
    avancePorCurso(idEstudiante),
    resumenEvaluaciones(idEstudiante),
    diasDeRacha(idEstudiante),
  ]);

  return {
    progreso: {
      leccionesCompletadas: avance.completadas,
      leccionesTotales: avance.totales,
      porcentaje: avance.porcentaje,
    },
    porCurso,
    evaluaciones,
    rachaDias,
  };
}

/**
 * Avance por cada curso inscrito (agregación SQL con la MISMA fórmula).
 * @param {number} idEstudiante
 * @returns {Promise<Object[]>}
 */
async function avancePorCurso(idEstudiante) {
  const { rows } = await query(
    `SELECT c.id, c.titulo,
            (COUNT(*) FILTER (WHERE p.completada))::int AS lecciones_completadas,
            COUNT(*)::int AS lecciones_totales,
            ${sqlPorcentaje('p.completada')} AS porcentaje
     FROM inscripciones i
     INNER JOIN cursos c ON c.id = i.id_curso
     INNER JOIN lecciones l ON l.id_curso = c.id
     LEFT JOIN progreso p ON p.id_leccion = l.id AND p.id_usuario = i.id_estudiante
     WHERE i.id_estudiante = $1
     GROUP BY c.id, c.titulo
     ORDER BY c.titulo ASC`,
    [idEstudiante]
  );
  // Postgres minusculiza los alias sin comillas: se mapea al contrato camelCase.
  return rows.map((fila) => ({
    id: fila.id,
    titulo: fila.titulo,
    leccionesCompletadas: fila.lecciones_completadas,
    leccionesTotales: fila.lecciones_totales,
    porcentaje: fila.porcentaje,
  }));
}

/**
 * Resumen de respuestas del estudiante: cuántas respondió, cuántas acertó
 * y su precisión (0-100, misma fórmula de porcentaje).
 * @param {number} idEstudiante
 * @returns {Promise<{ respondidas: number, correctas: number, precision: number }>}
 */
async function resumenEvaluaciones(idEstudiante) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS respondidas,
            (COUNT(*) FILTER (WHERE r.correcta))::int AS correctas,
            ${sqlPorcentaje('r.correcta')} AS precision
     FROM resultados r
     WHERE r.id_usuario = $1`,
    [idEstudiante]
  );
  return rows[0];
}

/**
 * Racha de días consecutivos con actividad (progreso o respuestas) que
 * termina en el último día con actividad; 0 si la última actividad es de
 * hace más de un día. Días calculados en UTC.
 *
 * @param {number} idEstudiante
 * @returns {Promise<number>}
 */
async function diasDeRacha(idEstudiante) {
  const { rows } = await query(
    `WITH dias AS (
       SELECT DISTINCT (fecha AT TIME ZONE 'UTC')::date AS dia
       FROM (
         SELECT p.actualizado_en AS fecha
         FROM progreso p
         WHERE p.id_usuario = $1
         UNION ALL
         SELECT r.respondida_en AS fecha
         FROM resultados r
         WHERE r.id_usuario = $1
       ) actividad
     ),
     grupos AS (
       SELECT d.dia,
              d.dia - (ROW_NUMBER() OVER (ORDER BY d.dia ASC))::int AS grupo
       FROM dias d
     )
     SELECT CASE
       WHEN (SELECT MAX(d.dia) FROM dias d)
            >= (now() AT TIME ZONE 'UTC')::date - 1
       THEN COALESCE((
         SELECT COUNT(*)::int
         FROM grupos g
         WHERE g.grupo = (
           SELECT g2.grupo FROM grupos g2 ORDER BY g2.dia DESC LIMIT 1
         )
       ), 0)
       ELSE 0
     END AS racha_dias`,
    [idEstudiante]
  );
  return rows[0].racha_dias;
}

module.exports = { estadisticas };
