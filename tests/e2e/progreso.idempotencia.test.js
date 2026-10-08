/**
 * tests/e2e/progreso.idempotencia.test.js
 * DoD Sprint 3 (3): POST /api/progreso repetido NO duplica filas y actualiza
 * la fecha; el porcentaje de avance se consulta ya calculado por SQL
 * (progreso.service es el único lugar con la fórmula).
 */
const { Client } = require('pg');

const { request, app, login, registrar, auth, crearCurso } = require('./ayudantes');

function dormir(ms) {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

async function contarProgreso(idUsuario, idLeccion) {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL });
  await cliente.connect();
  try {
    const { rows } = await cliente.query(
      `SELECT COUNT(*)::int AS total FROM progreso
       WHERE id_usuario = $1 AND id_leccion = $2`,
      [idUsuario, idLeccion]
    );
    return rows[0].total;
  } finally {
    await cliente.end();
  }
}

async function prepararEscenario() {
  const tutor = await login('tutor@edulite.test', 'EduLite123!');
  // Estudiante fresco: no contamina el estado del estudiante del seed
  // (el test de inscripciones asume que el estudiante del seed empieza
  // sin inscripciones en el primer curso del catálogo).
  const estudiante = await registrar();

  const curso = await crearCurso({
    token: tutor.accessToken,
    nombre: `Curso progreso ${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
  });

  await request(app)
    .patch(`/api/cursos/${curso.id}`)
    .set(auth(tutor.accessToken))
    .send({ publicado: true });

  const leccionRes = await request(app)
    .post(`/api/cursos/${curso.id}/lecciones`)
    .set(auth(tutor.accessToken))
    .send({ orden: 1, titulo: 'Primera lección' });
  expect(leccionRes.status).toBe(201);

  await request(app)
    .post(`/api/cursos/${curso.id}/inscribirse`)
    .set(auth(estudiante.accessToken));

  return { tutor, estudiante, curso, leccion: leccionRes.body.data.leccion };
}

describe('Progreso idempotente (Sprint 3)', () => {
  test('DoD 3: el mismo par usuario+lección no duplica filas y actualiza la fecha', async () => {
    const { estudiante, curso, leccion } = await prepararEscenario();

    const primera = await request(app)
      .post('/api/progreso')
      .set(auth(estudiante.accessToken))
      .send({ idLeccion: leccion.id, completada: true });
    expect(primera.status).toBe(200);
    expect(primera.body.data.progreso.completada).toBe(true);
    const fechaPrimera = new Date(primera.body.data.progreso.actualizado_en).getTime();
    expect(fechaPrimera).toBeGreaterThan(0);

    // Pausa corta para que now() de la base avance entre ambas peticiones.
    await dormir(50);

    const segunda = await request(app)
      .post('/api/progreso')
      .set(auth(estudiante.accessToken))
      .send({ idLeccion: leccion.id, completada: true });
    expect(segunda.status).toBe(200);
    const fechaSegunda = new Date(segunda.body.data.progreso.actualizado_en).getTime();
    expect(fechaSegunda).toBeGreaterThan(fechaPrimera);

    // Verificación directa en la base: exactamente 1 fila
    const total = await contarProgreso(estudiante.usuario.id, leccion.id);
    expect(total).toBe(1);

    // Y el avance del curso refleja la lección completada (agregación SQL)
    const avance = await request(app)
      .get(`/api/estudiantes/me/progreso?cursoId=${curso.id}`)
      .set(auth(estudiante.accessToken));
    expect(avance.status).toBe(200);
    expect(avance.body.data.completadas).toBe(1);
    expect(avance.body.data.totales).toBe(1);
    expect(avance.body.data.porcentaje).toBe(100);
    expect(avance.body.data.lecciones[0].completada).toBe(true);
  });

  test('desmarcar una lección vuelve el porcentaje a 0 sin duplicar filas', async () => {
    const { estudiante, curso, leccion } = await prepararEscenario();

    await request(app)
      .post('/api/progreso')
      .set(auth(estudiante.accessToken))
      .send({ idLeccion: leccion.id, completada: true });

    const desmarcada = await request(app)
      .post('/api/progreso')
      .set(auth(estudiante.accessToken))
      .send({ idLeccion: leccion.id, completada: false });
    expect(desmarcada.status).toBe(200);
    expect(desmarcada.body.data.progreso.completada).toBe(false);

    const total = await contarProgreso(estudiante.usuario.id, leccion.id);
    expect(total).toBe(1);

    const avance = await request(app)
      .get(`/api/estudiantes/me/progreso?cursoId=${curso.id}`)
      .set(auth(estudiante.accessToken));
    expect(avance.status).toBe(200);
    expect(avance.body.data.completadas).toBe(0);
    expect(avance.body.data.porcentaje).toBe(0);
    expect(avance.body.data.lecciones[0].completada).toBe(false);
  });

  test('acceso: exige ESTUDIANTE inscrito y cursoId válido', async () => {
    const { tutor, curso, leccion } = await prepararEscenario();

    // Un estudiante NO inscrito no puede reportar progreso (403)
    const ajeno = await registrar();
    const sinInscripcion = await request(app)
      .post('/api/progreso')
      .set(auth(ajeno.accessToken))
      .send({ idLeccion: leccion.id, completada: true });
    expect(sinInscripcion.status).toBe(403);

    // Lección inexistente → 404
    const leccionInexistente = await request(app)
      .post('/api/progreso')
      .set(auth(ajeno.accessToken))
      .send({ idLeccion: 999999, completada: true });
    expect(leccionInexistente.status).toBe(404);

    // Un TUTOR no usa este endpoint (403)
    const comoTutor = await request(app)
      .post('/api/progreso')
      .set(auth(tutor.accessToken))
      .send({ idLeccion: leccion.id, completada: true });
    expect(comoTutor.status).toBe(403);

    // GET /me/progreso sin cursoId → 400
    const sinCursoId = await request(app)
      .get('/api/estudiantes/me/progreso')
      .set(auth(tutor.accessToken));
    expect(sinCursoId.status).toBe(403); // el rol falla antes que la validación

    const ajenoSinCurso = await request(app)
      .get('/api/estudiantes/me/progreso')
      .set(auth(ajeno.accessToken));
    expect(ajenoSinCurso.status).toBe(400);

    // Curso inexistente → 404
    const cursoInexistente = await request(app)
      .get('/api/estudiantes/me/progreso?cursoId=999999')
      .set(auth(ajeno.accessToken));
    expect(cursoInexistente.status).toBe(404);

    // Curso existente pero no inscrito → 403
    const noInscrito = await request(app)
      .get(`/api/estudiantes/me/progreso?cursoId=${curso.id}`)
      .set(auth(ajeno.accessToken));
    expect(noInscrito.status).toBe(403);
  });

  test('GET /api/estudiantes/me/estadisticas devuelve el contrato 5.4', async () => {
    const { estudiante, curso, leccion } = await prepararEscenario();

    await request(app)
      .post('/api/progreso')
      .set(auth(estudiante.accessToken))
      .send({ idLeccion: leccion.id, completada: true });

    const respuesta = await request(app)
      .get('/api/estudiantes/me/estadisticas')
      .set(auth(estudiante.accessToken));
    expect(respuesta.status).toBe(200);

    const datos = respuesta.body.data;

    // Avance global (porcentaje calculado por SQL, nunca por JS)
    expect(datos.progreso.leccionesCompletadas).toBeGreaterThanOrEqual(1);
    expect(datos.progreso.leccionesTotales).toBeGreaterThanOrEqual(
      datos.progreso.leccionesCompletadas
    );
    expect(typeof datos.progreso.porcentaje).toBe('number');
    expect(datos.progreso.porcentaje).toBeGreaterThanOrEqual(0);
    expect(datos.progreso.porcentaje).toBeLessThanOrEqual(100);

    // Avance del curso recién completado
    const cursoPrueba = datos.porCurso.find((c) => c.id === curso.id);
    expect(cursoPrueba).toBeDefined();
    expect(cursoPrueba.leccionesCompletadas).toBe(1);
    expect(cursoPrueba.leccionesTotales).toBe(1);
    expect(cursoPrueba.porcentaje).toBe(100);

    // Resumen de evaluaciones
    expect(typeof datos.evaluaciones.respondidas).toBe('number');
    expect(typeof datos.evaluaciones.correctas).toBe('number');
    expect(typeof datos.evaluaciones.precision).toBe('number');

    // Racha de días con actividad
    expect(typeof datos.rachaDias).toBe('number');
    expect(datos.rachaDias).toBeGreaterThanOrEqual(0);
  });
});
