/**
 * tests/e2e/tutores.panel.test.js
 * Sprint 5 — panel del tutor: avance de SUS estudiantes (aislamiento entre
 * tutores) y estadísticas agregadas (sección 5.4).
 */
const { request, app, login, registrar, auth, crearCurso } = require('./ayudantes');

/**
 * Crea un curso publicado con una lección, lo deja publicado e inscribe
 * al estudiante indicado.
 */
async function prepararCurso({ tokenTutor, estudiante, nombre }) {
  const curso = await crearCurso({ token: tokenTutor, nombre });
  await request(app)
    .patch(`/api/cursos/${curso.id}`)
    .set(auth(tokenTutor))
    .send({ publicado: true });

  const leccion = await request(app)
    .post(`/api/cursos/${curso.id}/lecciones`)
    .set(auth(tokenTutor))
    .send({ orden: 1, titulo: 'Lección única' });
  expect(leccion.status).toBe(201);

  await request(app)
    .post(`/api/cursos/${curso.id}/inscribirse`)
    .set(auth(estudiante.accessToken));

  return { curso, leccion: leccion.body.data.leccion };
}

describe('Panel del tutor (Sprint 5)', () => {
  test('GET /api/tutores/me/estudiantes muestra avance y último acceso de SUS cursos', async () => {
    const tutor = await login('tutor@edulite.test', 'EduLite123!');
    const estudiante = await registrar();
    const { leccion } = await prepararCurso({
      tokenTutor: tutor.accessToken,
      estudiante,
      nombre: `Curso panel ${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    });

    // Sin actividad: 0% y último acceso null
    const antes = await request(app)
      .get('/api/tutores/me/estudiantes')
      .set(auth(tutor.accessToken));
    expect(antes.status).toBe(200);
    const filaAntes = antes.body.data.estudiantes.find(
      (e) => e.idEstudiante === estudiante.usuario.id && e.curso
    );
    expect(filaAntes).toBeDefined();
    expect(filaAntes.leccionesCompletadas).toBe(0);
    expect(filaAntes.porcentaje).toBe(0);
    expect(filaAntes.ultimoAcceso).toBeNull();

    // Con actividad: 100% y último acceso con valor
    await request(app)
      .post('/api/progreso')
      .set(auth(estudiante.accessToken))
      .send({ idLeccion: leccion.id, completada: true });

    const despues = await request(app)
      .get('/api/tutores/me/estudiantes')
      .set(auth(tutor.accessToken));
    expect(despues.status).toBe(200);
    const fila = despues.body.data.estudiantes.find(
      (e) => e.idEstudiante === estudiante.usuario.id
    );
    expect(fila.leccionesCompletadas).toBe(1);
    expect(fila.leccionesTotales).toBe(1);
    expect(fila.porcentaje).toBe(100);
    expect(fila.ultimoAcceso).not.toBeNull();
    expect(typeof despues.body.data.total).toBe('number');
  });

  test('un tutor NO ve el avance de estudiantes de cursos de otro tutor', async () => {
    const tutorA = await login('tutor@edulite.test', 'EduLite123!');
    const tutorB = await registrar({ rol: 'TUTOR', nombre: 'Tutor B' });

    // Un estudiante solo del tutor A, otro solo del tutor B
    const estudianteA = await registrar({ nombre: 'Estudiante de A' });
    const estudianteB = await registrar({ nombre: 'Estudiante de B' });

    const { leccion: leccionA } = await prepararCurso({
      tokenTutor: tutorA.accessToken,
      estudiante: estudianteA,
      nombre: `Curso A ${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    });
    const { curso: cursoB } = await prepararCurso({
      tokenTutor: tutorB.accessToken,
      estudiante: estudianteB,
      nombre: `Curso B ${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    });

    // El estudiante de A avanza; el de B también (pero es de B)
    await request(app)
      .post('/api/progreso')
      .set(auth(estudianteA.accessToken))
      .send({ idLeccion: leccionA.id, completada: true });

    // Tutor A: ve al estudiante de A, NUNCA al de B
    const listaA = await request(app)
      .get('/api/tutores/me/estudiantes')
      .set(auth(tutorA.accessToken));
    expect(listaA.status).toBe(200);
    const idsVistos = listaA.body.data.estudiantes.map((e) => e.idEstudiante);
    expect(idsVistos).toContain(estudianteA.usuario.id);
    expect(idsVistos).not.toContain(estudianteB.usuario.id);
    expect(listaA.body.data.estudiantes.every((e) => e.idCurso !== cursoB.id)).toBe(true);

    // Estadísticas de A: sus cursos, nunca el curso B
    const statsA = await request(app)
      .get('/api/tutores/me/estadisticas')
      .set(auth(tutorA.accessToken));
    expect(statsA.status).toBe(200);
    expect(statsA.body.data.porCurso.some((c) => c.id === cursoB.id)).toBe(false);

    // Tutor B: ve a su estudiante, no al de A
    const listaB = await request(app)
      .get('/api/tutores/me/estudiantes')
      .set(auth(tutorB.accessToken));
    expect(listaB.status).toBe(200);
    const idsB = listaB.body.data.estudiantes.map((e) => e.idEstudiante);
    expect(idsB).toContain(estudianteB.usuario.id);
    expect(idsB).not.toContain(estudianteA.usuario.id);
  });

  test('GET /api/tutores/me/estadisticas devuelve el contrato 5.4 del tutor', async () => {
    const tutor = await login('tutor@edulite.test', 'EduLite123!');
    const estudiante = await registrar();
    const { curso, leccion } = await prepararCurso({
      tokenTutor: tutor.accessToken,
      estudiante,
      nombre: `Curso stats ${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    });

    await request(app)
      .post('/api/progreso')
      .set(auth(estudiante.accessToken))
      .send({ idLeccion: leccion.id, completada: true });

    const respuesta = await request(app)
      .get('/api/tutores/me/estadisticas')
      .set(auth(tutor.accessToken));
    expect(respuesta.status).toBe(200);

    const datos = respuesta.body.data;

    // progreso: avance global (agregación SQL, nunca por JS)
    expect(datos.progreso.leccionesCompletadas).toBeGreaterThanOrEqual(1);
    expect(datos.progreso.leccionesTotales).toBeGreaterThanOrEqual(
      datos.progreso.leccionesCompletadas
    );
    expect(typeof datos.progreso.porcentaje).toBe('number');
    expect(datos.progreso.porcentaje).toBeGreaterThanOrEqual(0);
    expect(datos.progreso.porcentaje).toBeLessThanOrEqual(100);

    // porCurso: el curso de prueba con su avance y estudiantes
    const cursoPrueba = datos.porCurso.find((c) => c.id === curso.id);
    expect(cursoPrueba).toBeDefined();
    expect(cursoPrueba.estudiantes).toBeGreaterThanOrEqual(1);
    expect(cursoPrueba.leccionesCompletadas).toBeGreaterThanOrEqual(1);
    expect(cursoPrueba.porcentaje).toBe(100);

    // evaluaciones: contrato idéntico al del estudiante
    expect(typeof datos.evaluaciones.respondidas).toBe('number');
    expect(typeof datos.evaluaciones.correctas).toBe('number');
    expect(typeof datos.evaluaciones.precision).toBe('number');

    // tutorias: conteos por estado
    expect(typeof datos.tutorias.pendientes).toBe('number');
    expect(typeof datos.tutorias.confirmadas).toBe('number');
    expect(typeof datos.tutorias.realizadas).toBe('number');
    expect(typeof datos.tutorias.canceladas).toBe('number');
  });

  test('los endpoints del panel rechazan a estudiantes (403)', async () => {
    const estudiante = await registrar();

    const avance = await request(app)
      .get('/api/tutores/me/estudiantes')
      .set(auth(estudiante.accessToken));
    expect(avance.status).toBe(403);

    const stats = await request(app)
      .get('/api/tutores/me/estadisticas')
      .set(auth(estudiante.accessToken));
    expect(stats.status).toBe(403);
  });
});
