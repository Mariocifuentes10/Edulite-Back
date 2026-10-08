/**
 * modulos/tutores/tutores.service.js
 * SQL de las vistas "me" del tutor (panel del tutor, Sprint 5). El
 * porcentaje de AVANCE nunca se calcula aquí en JavaScript: se usa la
 * fórmula única de utils/porcentaje.js aplicada con agregación SQL.
 * Todas las consultas filtran por c.id_tutor = $1: el tutor solo ve
 * datos de SUS cursos y de los estudiantes inscritos en ellos.
 */
const { query } = require('../../config/db');
const { sqlPorcentaje } = require('../../utils/porcentaje');

/**
 * Estudiantes de los cursos del tutor con su avance por curso y último
 * acceso (última actividad registrada en progreso; NULL si nunca tuvo).
 * Una fila por par estudiante-curso, paginado.
 *
 * @param {Object} parametros - { idTutor, pagina, limite }
 * @returns {Promise<{ estudiantes: Object[], total: number }>}
 */
async function listarEstudiantes({ idTutor, pagina = 1, limite = 10 }) {
  const desplazamiento = (pagina - 1) * limite;

  const [filas, total] = await Promise.all([
    query(
      `SELECT u.id AS id_estudiante, u.nombre, u.email,
              c.id AS id_curso, c.titulo AS curso,
              (COUNT(*) FILTER (WHERE p.completada))::int AS lecciones_completadas,
              COUNT(l.id)::int AS lecciones_totales,
              ${sqlPorcentaje('p.completada', 'COUNT(l.id)')} AS porcentaje,
              MAX(p.actualizado_en) AS ultimo_acceso
       FROM inscripciones i
       INNER JOIN cursos c ON c.id = i.id_curso
       INNER JOIN usuarios u ON u.id = i.id_estudiante
       LEFT JOIN lecciones l ON l.id_curso = c.id
       LEFT JOIN progreso p ON p.id_leccion = l.id AND p.id_usuario = i.id_estudiante
       WHERE c.id_tutor = $1
       GROUP BY u.id, u.nombre, u.email, c.id, c.titulo
       ORDER BY c.titulo ASC, u.nombre ASC
       LIMIT $2 OFFSET $3`,
      [idTutor, limite, desplazamiento]
    ),
    query(
      `SELECT COUNT(*)::int AS total
       FROM (
         SELECT i.id_estudiante, i.id_curso
         FROM inscripciones i
         INNER JOIN cursos c ON c.id = i.id_curso
         WHERE c.id_tutor = $1
       ) AS pares`,
      [idTutor]
    ),
  ]);

  const estudiantes = filas.rows.map((fila) => ({
    idEstudiante: fila.id_estudiante,
    nombre: fila.nombre,
    email: fila.email,
    idCurso: fila.id_curso,
    curso: fila.curso,
    leccionesCompletadas: fila.lecciones_completadas,
    leccionesTotales: fila.lecciones_totales,
    porcentaje: fila.porcentaje,
    ultimoAcceso: fila.ultimo_acceso,
  }));

  return { estudiantes, total: total.rows[0].total };
}

/**
 * Estadísticas del tutor autenticado (sección 5.4, espejo de la del
 * estudiante agregado sobre SUS cursos + resumen de tutorías).
 *
 * @param {number} idTutor
 * @returns {Promise<Object>}
 */
async function estadisticas(idTutor) {
  const [avance, porCurso, evaluaciones, tutorias] = await Promise.all([
    avanceGlobal(idTutor),
    avancePorCurso(idTutor),
    resumenEvaluaciones(idTutor),
    resumenTutorias(idTutor),
  ]);

  return {
    progreso: {
      leccionesCompletadas: avance.completadas,
      leccionesTotales: avance.totales,
      porcentaje: avance.porcentaje,
    },
    porCurso,
    evaluaciones,
    tutorias,
  };
}

/**
 * Avance global de los estudiantes inscritos en los cursos del tutor
 * (misma fórmula que progreso.service, aplicada con la agregación del tutor).
 * @param {number} idTutor
 * @returns {Promise<{ completadas: number, totales: number, porcentaje: number }>}
 */
async function avanceGlobal(idTutor) {
  const { rows } = await query(
    `SELECT (COUNT(*) FILTER (WHERE p.completada))::int AS completadas,
            COUNT(*)::int AS totales,
            ${sqlPorcentaje('p.completada')} AS porcentaje
     FROM inscripciones i
     INNER JOIN cursos c ON c.id = i.id_curso
     INNER JOIN lecciones l ON l.id_curso = c.id
     LEFT JOIN progreso p ON p.id_leccion = l.id AND p.id_usuario = i.id_estudiante
     WHERE c.id_tutor = $1`,
    [idTutor]
  );
  return rows[0];
}

/**
 * Avance agregado por cada curso del tutor. Los contadores están en
 * espacio de "pares estudiante×lección" (igual que avanceGlobal): cada
 * fila es un par; las filas de cursos sin inscritos o sin lecciones no
 * cuentan como totales.
 * @param {number} idTutor
 * @returns {Promise<Object[]>}
 */
async function avancePorCurso(idTutor) {
  const paresValidos = 'COUNT(*) FILTER (WHERE i.id_estudiante IS NOT NULL AND l.id IS NOT NULL)';
  const { rows } = await query(
    `SELECT c.id, c.titulo,
            COUNT(DISTINCT i.id_estudiante)::int AS estudiantes,
            (COUNT(*) FILTER (WHERE p.completada))::int AS lecciones_completadas,
            ${paresValidos}::int AS lecciones_totales,
            ${sqlPorcentaje('p.completada', paresValidos)} AS porcentaje
     FROM cursos c
     LEFT JOIN inscripciones i ON i.id_curso = c.id
     LEFT JOIN lecciones l ON l.id_curso = c.id
     LEFT JOIN progreso p ON p.id_leccion = l.id AND p.id_usuario = i.id_estudiante
     WHERE c.id_tutor = $1
     GROUP BY c.id, c.titulo
     ORDER BY c.titulo ASC`,
    [idTutor]
  );
  // Postgres minusculiza los alias sin comillas: se mapea al contrato camelCase.
  return rows.map((fila) => ({
    id: fila.id,
    titulo: fila.titulo,
    estudiantes: fila.estudiantes,
    leccionesCompletadas: fila.lecciones_completadas,
    leccionesTotales: fila.lecciones_totales,
    porcentaje: fila.porcentaje,
  }));
}

/**
 * Resumen de respuestas a evaluaciones de los estudiantes del tutor.
 * Se cuentan solo las respuestas cuyo autor está inscrito en alguno de
 * SUS cursos; UNIQUE (id_curso, id_estudiante) evita duplicar filas.
 * @param {number} idTutor
 * @returns {Promise<{ respondidas: number, correctas: number, precision: number }>}
 */
async function resumenEvaluaciones(idTutor) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS respondidas,
            (COUNT(*) FILTER (WHERE r.correcta))::int AS correctas,
            ${sqlPorcentaje('r.correcta')} AS precision
     FROM resultados r
     WHERE EXISTS (
       SELECT 1 FROM inscripciones i
       INNER JOIN cursos c ON c.id = i.id_curso
       WHERE i.id_estudiante = r.id_usuario AND c.id_tutor = $1
     )`,
    [idTutor]
  );
  return rows[0];
}

/**
 * Tutorías del tutor por estado (0 en los que no tenga filas).
 * @param {number} idTutor
 * @returns {Promise<{ pendientes: number, confirmadas: number, realizadas: number, canceladas: number }>}
 */
async function resumenTutorias(idTutor) {
  const { rows } = await query(
    `SELECT estado, COUNT(*)::int AS total
     FROM tutorias
     WHERE id_tutor = $1
     GROUP BY estado`,
    [idTutor]
  );

  const resumen = { pendientes: 0, confirmadas: 0, realizadas: 0, canceladas: 0 };
  const claves = { PENDIENTE: 'pendientes', CONFIRMADA: 'confirmadas', REALIZADA: 'realizadas', CANCELADA: 'canceladas' };
  for (const fila of rows) {
    resumen[claves[fila.estado]] = fila.total;
  }
  return resumen;
}

module.exports = { listarEstudiantes, estadisticas };
