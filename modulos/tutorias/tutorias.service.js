/**
 * modulos/tutorias/tutorias.service.js
 * SQL del módulo tutorias. Aquí vive la ÚNICA tabla de transiciones de
 * estado permitidas (el COMMENT de la tabla en db/schema.sql establece que
 * se validan en la aplicación, no en la base).
 */
const { query } = require('../../config/db');
const AppError = require('../../utils/app-error');

/**
 * Transiciones de estado permitidas por rol: origen → destinos.
 * REALIZADA y CANCELADA no aparecen como origen: son estados terminales.
 * El ADMIN no tiene transiciones (las rutas solo admiten ESTUDIANTE/TUTOR).
 */
const TRANSICIONES = {
  TUTOR: {
    PENDIENTE: ['CONFIRMADA', 'CANCELADA'],
    CONFIRMADA: ['REALIZADA', 'CANCELADA'],
  },
  ESTUDIANTE: {
    PENDIENTE: ['CANCELADA'],
    CONFIRMADA: ['CANCELADA'],
  },
};

/** Columnas de la tutoría devueltas siempre al cliente. */
const COLUMNAS_TUTORIA =
  't.id, t.id_estudiante, t.id_tutor, t.id_curso, t.fecha, t.tema, t.estado, t.creado_en';

/**
 * Crea una solicitud de tutoría. Solo se puede pedir a un tutor de un curso
 * en el que el estudiante esté inscrito (con idCurso: ese curso; sin
 * idCurso: cualquier curso del tutor).
 *
 * @param {Object} parametros - { idEstudiante, idTutor, idCurso?, fecha, tema }
 * @returns {Promise<Object>} tutoría creada con nombres de estudiante y tutor
 * @throws {AppError} 404 tutor/curso inexistente, 400 curso ajeno al tutor, 403 sin inscripción
 */
async function crear({ idEstudiante, idTutor, idCurso = null, fecha, tema }) {
  const { rows: tutores } = await query(
    `SELECT id FROM usuarios
     WHERE id = $1 AND rol = 'TUTOR' AND activo = TRUE`,
    [idTutor]
  );
  if (!tutores[0]) throw new AppError('Tutor no encontrado', 404);

  if (idCurso !== null) {
    const { rows: cursos } = await query(
      'SELECT id FROM cursos WHERE id = $1',
      [idCurso]
    );
    if (!cursos[0]) throw new AppError('Curso no encontrado', 404);

    const { rows: propios } = await query(
      'SELECT id FROM cursos WHERE id = $1 AND id_tutor = $2',
      [idCurso, idTutor]
    );
    if (!propios[0]) {
      throw new AppError('El curso no pertenece a ese tutor', 400);
    }
  }

  const { rows: inscripciones } = await query(
    `SELECT EXISTS (
       SELECT 1 FROM inscripciones i
       INNER JOIN cursos c ON c.id = i.id_curso
       WHERE i.id_estudiante = $1
         AND c.id_tutor = $2
         AND ($3::int IS NULL OR c.id = $3)
     ) AS existe`,
    [idEstudiante, idTutor, idCurso]
  );
  if (!inscripciones[0].existe) {
    throw new AppError(
      idCurso === null
        ? 'No está inscrito en ningún curso de ese tutor'
        : 'No está inscrito en este curso',
      403
    );
  }

  const { rows: insertadas } = await query(
    `INSERT INTO tutorias (id_estudiante, id_tutor, id_curso, fecha, tema)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [idEstudiante, idTutor, idCurso, fecha, tema]
  );

  const { rows } = await query(
    `SELECT ${COLUMNAS_TUTORIA},
            e.nombre AS nombre_estudiante,
            tu.nombre AS nombre_tutor,
            c.titulo AS curso
     FROM tutorias t
     INNER JOIN usuarios e ON e.id = t.id_estudiante
     INNER JOIN usuarios tu ON tu.id = t.id_tutor
     LEFT JOIN cursos c ON c.id = t.id_curso
     WHERE t.id = $1`,
    [insertadas[0].id]
  );
  return rows[0];
}

/**
 * Listado paginado de tutorías del usuario autenticado: el estudiante ve
 * las suyas, el tutor ve las que le piden. Filtro opcional por estado.
 *
 * @param {Object} parametros - { rol, idUsuario, estado?, pagina, limite }
 * @returns {Promise<{ tutorias: Object[], total: number }>}
 */
async function listar({ rol, idUsuario, estado = null, pagina = 1, limite = 10 }) {
  const desplazamiento = (pagina - 1) * limite;
  // Lista blanca: columna de dueño según rol (jamás dato del cliente).
  const columnaDueno = rol === 'TUTOR' ? 't.id_tutor' : 't.id_estudiante';
  const condiciones = `${columnaDueno} = $1
    AND ($2::estado_tutoria IS NULL OR t.estado = $2::estado_tutoria)`;

  const [filas, total] = await Promise.all([
    query(
      `SELECT ${COLUMNAS_TUTORIA},
              e.nombre AS nombre_estudiante,
              tu.nombre AS nombre_tutor,
              c.titulo AS curso
       FROM tutorias t
       INNER JOIN usuarios e ON e.id = t.id_estudiante
       INNER JOIN usuarios tu ON tu.id = t.id_tutor
       LEFT JOIN cursos c ON c.id = t.id_curso
       WHERE ${condiciones}
       ORDER BY t.fecha ASC, t.id ASC
       LIMIT $3 OFFSET $4`,
      [idUsuario, estado, limite, desplazamiento]
    ),
    query(
      `SELECT COUNT(*)::int AS total FROM tutorias t WHERE ${condiciones}`,
      [idUsuario, estado]
    ),
  ]);

  return { tutorias: filas.rows, total: total.rows[0].total };
}

/**
 * Cambia el estado de una tutoría validando la transición en la tabla
 * TRANSICIONES según el rol del usuario, y con un UPDATE condicional
 * (WHERE estado = origen) que hace la operación a prueba de carreras.
 *
 * @param {Object} parametros - { idTutoria, rol, idUsuario, nuevoEstado }
 * @returns {Promise<Object>} tutoría actualizada con nombres
 * @throws {AppError} 404 inexistente, 403 ajena, 409 transición inválida
 */
async function cambiarEstado({ idTutoria, rol, idUsuario, nuevoEstado }) {
  const { rows: tutorias } = await query(
    'SELECT id, id_estudiante, id_tutor, estado FROM tutorias WHERE id = $1',
    [idTutoria]
  );
  const tutoria = tutorias[0];
  if (!tutoria) throw new AppError('Tutoría no encontrada', 404);

  const esDueno =
    (rol === 'TUTOR' && tutoria.id_tutor === idUsuario) ||
    (rol === 'ESTUDIANTE' && tutoria.id_estudiante === idUsuario);
  if (!esDueno) throw new AppError('La tutoría no le pertenece', 403);

  const permitidas = (TRANSICIONES[rol] || {})[tutoria.estado] || [];
  if (!permitidas.includes(nuevoEstado)) {
    throw new AppError(
      `Transición no permitida: ${tutoria.estado} → ${nuevoEstado}. ` +
        (permitidas.length > 0
          ? `Permitidas desde ${tutoria.estado}: ${permitidas.join(', ')}`
          : `${tutoria.estado} es un estado final`),
      409
    );
  }

  // Lock optimista: si otra petición cambió el estado entre el SELECT y
  // este UPDATE, rowCount = 0 y se responde 409 en vez de aplicar una
  // transición inválida.
  const { rowCount } = await query(
    'UPDATE tutorias SET estado = $2 WHERE id = $1 AND estado = $3',
    [idTutoria, nuevoEstado, tutoria.estado]
  );
  if (rowCount === 0) {
    throw new AppError(
      'La tutoría cambió de estado; vuelva a intentarlo',
      409
    );
  }

  const { rows } = await query(
    `SELECT ${COLUMNAS_TUTORIA},
            e.nombre AS nombre_estudiante,
            tu.nombre AS nombre_tutor,
            c.titulo AS curso
     FROM tutorias t
     INNER JOIN usuarios e ON e.id = t.id_estudiante
     INNER JOIN usuarios tu ON tu.id = t.id_tutor
     LEFT JOIN cursos c ON c.id = t.id_curso
     WHERE t.id = $1`,
    [idTutoria]
  );
  return rows[0];
}

module.exports = { TRANSICIONES, crear, listar, cambiarEstado };
