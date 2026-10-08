/**
 * modulos/inscripciones/inscripciones.service.js
 * SQL del módulo inscripciones. Idempotencia garantizada por
 * UNIQUE (id_curso, id_estudiante) + ON CONFLICT DO NOTHING.
 */
const { query } = require('../../config/db');

/**
 * Inscribe a un estudiante en un curso. Reenviar la misma inscripción nunca
 * falla ni duplica filas (ON CONFLICT DO NOTHING).
 *
 * @param {number} idCurso
 * @param {number} idEstudiante
 * @returns {Promise<{ insertada: boolean }>} insertada=false si ya estaba inscrito
 */
async function inscribirse(idCurso, idEstudiante) {
  const { rowCount } = await query(
    `INSERT INTO inscripciones (id_curso, id_estudiante)
     VALUES ($1, $2)
     ON CONFLICT (id_curso, id_estudiante) DO NOTHING`,
    [idCurso, idEstudiante]
  );
  return { insertada: rowCount === 1 };
}

/**
 * ¿Está el estudiante inscrito en el curso?
 * @param {number} idCurso
 * @param {number} idEstudiante
 * @returns {Promise<boolean>}
 */
async function estaInscrito(idCurso, idEstudiante) {
  const { rows } = await query(
    `SELECT EXISTS (
       SELECT 1 FROM inscripciones
       WHERE id_curso = $1 AND id_estudiante = $2
     ) AS existe`,
    [idCurso, idEstudiante]
  );
  return rows[0].existe;
}

/**
 * Cursos en los que está inscrito el estudiante (para /api/estudiantes/me/cursos).
 * @param {number} idEstudiante
 * @returns {Promise<Object[]>}
 */
async function listarCursosDelEstudiante(idEstudiante) {
  const { rows } = await query(
    `SELECT c.id, c.id_tutor, c.titulo, c.descripcion, c.nivel, c.publicado,
            u.nombre AS nombre_tutor,
            (SELECT COUNT(*) FROM lecciones l WHERE l.id_curso = c.id)::int AS total_lecciones,
            i.creado_en AS inscrito_en
     FROM inscripciones i
     INNER JOIN cursos c ON c.id = i.id_curso
     INNER JOIN usuarios u ON u.id = c.id_tutor
     WHERE i.id_estudiante = $1
     ORDER BY i.creado_en DESC`,
    [idEstudiante]
  );
  return rows;
}

module.exports = { inscribirse, estaInscrito, listarCursosDelEstudiante };
