/**
 * modulos/cursos/cursos.service.js
 * SQL del módulo cursos. Todo parametrizado ($1, $2, ...).
 * Nunca se concatenan valores a las consultas; el SET dinámico del PATCH
 * solo admite columnas de una lista blanca fija.
 */
const { query } = require('../../config/db');
const AppError = require('../../utils/app-error');

/** Columnas devueltas al cliente (más nombre_tutor y total_lecciones en listados). */
const COLUMNAS_CURSO =
  'c.id, c.id_tutor, c.titulo, c.descripcion, c.nivel, c.publicado, c.creado_en, c.actualizado_en';

/** Columnas que un cliente puede actualizar vía PATCH. */
const COLUMNAS_ACTUALIZABLES = ['titulo', 'descripcion', 'nivel', 'publicado'];

/**
 * Catálogo público: solo cursos publicados, con paginación y filtros.
 * @param {Object} filtros
 * @param {string} [filtros.nivel] - Coincidencia exacta de nivel
 * @param {string} [filtros.q] - Búsqueda en título o descripción
 * @param {number} filtros.pagina - 1-based
 * @param {number} filtros.limite
 * @returns {Promise<{ cursos: Object[], total: number }>}
 */
async function listarCatalogo({ nivel = null, q = null, pagina = 1, limite = 10 }) {
  const desplazamiento = (pagina - 1) * limite;
  const condiciones = `c.publicado = TRUE
    AND ($1::text IS NULL OR c.nivel = $1)
    AND ($2::text IS NULL
         OR c.titulo ILIKE '%' || $2 || '%'
         OR COALESCE(c.descripcion, '') ILIKE '%' || $2 || '%')`;

  const [filas, total] = await Promise.all([
    query(
      `SELECT ${COLUMNAS_CURSO},
              u.nombre AS nombre_tutor,
              (SELECT COUNT(*) FROM lecciones l WHERE l.id_curso = c.id)::int AS total_lecciones
       FROM cursos c
       INNER JOIN usuarios u ON u.id = c.id_tutor
       WHERE ${condiciones}
       ORDER BY c.creado_en DESC, c.id DESC
       LIMIT $3 OFFSET $4`,
      [nivel, q, limite, desplazamiento]
    ),
    query(
      `SELECT COUNT(*)::int AS total FROM cursos c WHERE ${condiciones}`,
      [nivel, q]
    ),
  ]);

  return { cursos: filas.rows, total: total.rows[0].total };
}

/**
 * Todos los cursos de un tutor (incluye borradores). Para GET /api/tutores/me/cursos.
 * @param {number} idTutor
 * @returns {Promise<Object[]>}
 */
async function listarDelTutor(idTutor) {
  const { rows } = await query(
    `SELECT ${COLUMNAS_CURSO},
            (SELECT COUNT(*) FROM lecciones l WHERE l.id_curso = c.id)::int AS total_lecciones
     FROM cursos c
     WHERE c.id_tutor = $1
     ORDER BY c.creado_en DESC, c.id DESC`,
    [idTutor]
  );
  return rows;
}

/**
 * Busca un curso por id (sin lecciones).
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
async function buscarPorId(id) {
  const { rows } = await query(
    `SELECT ${COLUMNAS_CURSO}, u.nombre AS nombre_tutor
     FROM cursos c
     INNER JOIN usuarios u ON u.id = c.id_tutor
     WHERE c.id = $1`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Crea un curso para el tutor indicado.
 * 409 si el tutor ya tiene un curso con ese título (UNIQUE id_tutor+titulo).
 * @param {Object} datos - { titulo, descripcion, nivel, id_tutor }
 * @returns {Promise<Object>}
 */
async function crear({ titulo, descripcion = null, nivel = null, id_tutor }) {
  try {
    const { rows } = await query(
      `INSERT INTO cursos (titulo, descripcion, nivel, publicado, id_tutor)
       VALUES ($1, $2, $3, FALSE, $4)
       RETURNING id, id_tutor, titulo, descripcion, nivel, publicado, creado_en, actualizado_en`,
      [titulo, descripcion, nivel, id_tutor]
    );
    return rows[0];
  } catch (error) {
    if (error.code === '23505') {
      throw new AppError('Ya tiene un curso con ese título', 409);
    }
    throw error;
  }
}

/**
 * Actualiza los campos enviados (lista blanca). Los valores van por parámetro.
 * @param {number} id
 * @param {Object} campos - Subconjunto de { titulo, descripcion, nivel, publicado }
 * @returns {Promise<Object>} curso actualizado
 */
async function actualizar(id, campos) {
  const sets = [];
  const parametros = [];

  for (const columna of COLUMNAS_ACTUALIZABLES) {
    if (campos[columna] !== undefined) {
      parametros.push(campos[columna]);
      sets.push(`${columna} = $${parametros.length}`);
    }
  }

  if (sets.length === 0) {
    throw new AppError('Debe enviar al menos un campo a actualizar', 400);
  }

  parametros.push(id);
  sets.push('actualizado_en = now()');

  try {
    const { rows } = await query(
      `UPDATE cursos SET ${sets.join(', ')}
       WHERE id = $${parametros.length}
       RETURNING id, id_tutor, titulo, descripcion, nivel, publicado, creado_en, actualizado_en`,
      parametros
    );
    if (!rows[0]) throw new AppError('Curso no encontrado', 404);
    return rows[0];
  } catch (error) {
    if (error.code === '23505') {
      throw new AppError('Ya tiene un curso con ese título', 409);
    }
    throw error;
  }
}

/**
 * Elimina un curso (y sus lecciones en cascada).
 * @param {number} id
 * @returns {Promise<void>}
 */
async function eliminar(id) {
  const { rowCount } = await query('DELETE FROM cursos WHERE id = $1', [id]);
  if (rowCount === 0) throw new AppError('Curso no encontrado', 404);
}

/**
 * Verificación de pertenencia reutilizable por otros módulos.
 * @param {number} idCurso
 * @param {number} idTutor
 * @returns {Promise<boolean>}
 */
async function cursoPerteneceAlTutor(idCurso, idTutor) {
  const { rows } = await query(
    'SELECT EXISTS (SELECT 1 FROM cursos WHERE id = $1 AND id_tutor = $2) AS existe',
    [idCurso, idTutor]
  );
  return rows[0].existe;
}

module.exports = {
  listarCatalogo,
  listarDelTutor,
  buscarPorId,
  crear,
  actualizar,
  eliminar,
  cursoPerteneceAlTutor,
};
