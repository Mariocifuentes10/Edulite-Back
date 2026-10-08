/**
 * modulos/admin/admin.service.js
 * SQL agregado del panel de administración. Toda la lógica de consulta vive
 * aquí (regla del proyecto: nada de SQL en el controller).
 */
const { query } = require('../../config/db');

/**
 * Estadísticas globales del panel de administración:
 *   • usuarios por rol
 *   • cursos publicados
 *   • lecciones completadas (todas las cuentas)
 *   • top 5 de cursos por cantidad de inscripciones
 *
 * @returns {Promise<Object>}
 */
async function estadisticas() {
  const { rows: usuariosPorRol } = await query(
    `SELECT rol, COUNT(*)::int AS total
     FROM usuarios
     GROUP BY rol
     ORDER BY rol`
  );

  const { rows: totalCursos } = await query(
    `SELECT COUNT(*)::int AS publicados FROM cursos WHERE publicado = TRUE`
  );

  const { rows: totalLecciones } = await query(
    `SELECT COUNT(*)::int AS completadas FROM progreso WHERE completada = TRUE`
  );

  const { rows: topCursos } = await query(
    `SELECT c.id,
            c.titulo,
            u.nombre AS nombre_tutor,
            COUNT(i.id)::int AS inscripciones
     FROM cursos c
     JOIN usuarios u ON u.id = c.id_tutor
     LEFT JOIN inscripciones i ON i.id_curso = c.id
     GROUP BY c.id, c.titulo, u.nombre
     ORDER BY inscripciones DESC, c.titulo ASC
     LIMIT 5`
  );

  return {
    usuariosPorRol,
    cursosPublicados: totalCursos[0].publicados,
    leccionesCompletadas: totalLecciones[0].completadas,
    topCursos,
  };
}

module.exports = { estadisticas };
