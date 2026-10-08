/**
 * modulos/lecciones/lecciones.service.js
 * SQL del módulo lecciones. Regla clave: los listados NUNCA incluyen la
 * columna `contenido`; solo la trae buscarPorId() para quien tiene acceso.
 */
const { query } = require('../../config/db');
const AppError = require('../../utils/app-error');

const COLUMNAS_LECCION = 'l.id, l.id_curso, l.orden, l.titulo, l.contenido, l.creado_en';

/** Columnas que un cliente puede actualizar vía PATCH. */
const COLUMNAS_ACTUALIZABLES = ['orden', 'titulo', 'contenido'];

/**
 * Lecciones de un curso SIN el contenido (para listados livianos).
 * @param {number} idCurso
 * @returns {Promise<Object[]>}
 */
async function listarPorCurso(idCurso) {
  const { rows } = await query(
    'SELECT l.id, l.id_curso, l.orden, l.titulo FROM lecciones l WHERE l.id_curso = $1 ORDER BY l.orden ASC',
    [idCurso]
  );
  return rows;
}

/**
 * Lección por id CON contenido (solo para quien acredite acceso).
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
async function buscarPorId(id) {
  const { rows } = await query(
    `SELECT ${COLUMNAS_LECCION} FROM lecciones l WHERE l.id = $1`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Busca una lección que pertenezca al curso indicado (para rutas anidadas).
 * @param {number} idCurso
 * @param {number} idLeccion
 * @returns {Promise<Object|null>}
 */
async function buscarPorCursoYId(idCurso, idLeccion) {
  const { rows } = await query(
    `SELECT ${COLUMNAS_LECCION} FROM lecciones l
     WHERE l.id = $1 AND l.id_curso = $2`,
    [idLeccion, idCurso]
  );
  return rows[0] || null;
}

/**
 * Valida que el orden esté libre dentro del curso (409 si está ocupado).
 * La restricción UNIQUE (id_curso, orden) es la red de seguridad final.
 *
 * @param {number} idCurso
 * @param {number} orden
 * @param {number} [idExcluido] - Lección que se está editando (no se cuenta)
 * @returns {Promise<void>}
 * @throws {AppError} 409 si el orden ya está usado
 */
async function verificarOrdenLibre(idCurso, orden, idExcluido = null) {
  const { rows } = await query(
    `SELECT l.id FROM lecciones l
     WHERE l.id_curso = $1 AND l.orden = $2 AND ($3::int IS NULL OR l.id <> $3)
     LIMIT 1`,
    [idCurso, orden, idExcluido]
  );
  if (rows.length > 0) {
    throw new AppError(`El orden ${orden} ya está usado en este curso`, 409);
  }
}

/**
 * Crea una lección. 409 si el orden se duplica (carrera concurrente).
 * @param {Object} datos - { id_curso, orden, titulo, contenido }
 * @returns {Promise<Object>}
 */
async function crear({ id_curso, orden, titulo, contenido = '' }) {
  try {
    const { rows } = await query(
      `INSERT INTO lecciones (id_curso, orden, titulo, contenido)
       VALUES ($1, $2, $3, $4)
       RETURNING id, id_curso, orden, titulo, contenido, creado_en`,
      [id_curso, orden, titulo, contenido]
    );
    return rows[0];
  } catch (error) {
    if (error.code === '23505') {
      throw new AppError(`El orden ${orden} ya está usado en este curso`, 409);
    }
    throw error;
  }
}

/**
 * Actualiza los campos enviados (lista blanca).
 * @param {number} id
 * @param {Object} campos - Subconjunto de { orden, titulo, contenido }
 * @returns {Promise<Object>}
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

  try {
    const { rows } = await query(
      `UPDATE lecciones SET ${sets.join(', ')}
       WHERE id = $${parametros.length}
       RETURNING id, id_curso, orden, titulo, contenido, creado_en`,
      parametros
    );
    if (!rows[0]) throw new AppError('Lección no encontrada', 404);
    return rows[0];
  } catch (error) {
    if (error.code === '23505') {
      throw new AppError(`Ese orden ya está usado en este curso`, 409);
    }
    throw error;
  }
}

/**
 * Elimina una lección.
 * @param {number} id
 * @returns {Promise<void>}
 */
async function eliminar(id) {
  const { rowCount } = await query('DELETE FROM lecciones WHERE id = $1', [id]);
  if (rowCount === 0) throw new AppError('Lección no encontrada', 404);
}

module.exports = {
  listarPorCurso,
  buscarPorId,
  buscarPorCursoYId,
  verificarOrdenLibre,
  crear,
  actualizar,
  eliminar,
};
