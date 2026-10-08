/**
 * tests/e2e/sync.limite.test.js
 * DoD Sprint 4 (3): límites del lote (200 ítems máx, array obligatorio),
 * control de acceso (solo ESTUDIANTE) y la barrera de los 200kb del body.
 */
const { randomUUID } = require('crypto');

const { request, app, login, registrar, auth } = require('./ayudantes');

const PASADA = () => new Date(Date.now() - 3600000).toISOString();

function itemValido(idLeccion) {
  return {
    tipo: 'PROGRESO',
    idCliente: randomUUID(),
    creadoEn: PASADA(),
    idLeccion,
    completada: true,
  };
}

describe('POST /api/sync: límites y acceso (Sprint 4)', () => {
  test('DoD 3: 201 ítems → 400 y NO se procesa ninguno', async () => {
    const estudiante = await registrar();

    const items = Array.from({ length: 201 }, () => itemValido(1));
    const respuesta = await request(app)
      .post('/api/sync')
      .set(auth(estudiante.accessToken))
      .send({ items });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.success).toBe(false);
    expect(respuesta.body.errors).toBeDefined();
  });

  test('DoD 3: exactamente 200 ítems → se procesa el lote completo', async () => {
    const tutor = await login('tutor@edulite.test', 'EduLite123!');
    const estudiante = await registrar();

    const cursoRes = await request(app)
      .post('/api/cursos')
      .set(auth(tutor.accessToken))
      .send({ titulo: `Curso lote 200 ${Date.now()}`, nivel: 'secundaria' });
    expect(cursoRes.status).toBe(201);
    const curso = cursoRes.body.data.curso;

    await request(app)
      .patch(`/api/cursos/${curso.id}`)
      .set(auth(tutor.accessToken))
      .send({ publicado: true });

    const leccionRes = await request(app)
      .post(`/api/cursos/${curso.id}/lecciones`)
      .set(auth(tutor.accessToken))
      .send({ orden: 1, titulo: 'Lección del lote grande' });
    expect(leccionRes.status).toBe(201);
    const idLeccion = leccionRes.body.data.leccion.id;

    await request(app)
      .post(`/api/cursos/${curso.id}/inscribirse`)
      .set(auth(estudiante.accessToken));

    const items = Array.from({ length: 200 }, () => itemValido(idLeccion));
    const respuesta = await request(app)
      .post('/api/sync')
      .set(auth(estudiante.accessToken))
      .send({ items });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.aceptados).toHaveLength(200);
    expect(respuesta.body.data.rechazados).toEqual([]);
  });

  test('items ausente, no-array o vacío → 400', async () => {
    const estudiante = await registrar();

    const sinItems = await request(app)
      .post('/api/sync')
      .set(auth(estudiante.accessToken))
      .send({});
    expect(sinItems.status).toBe(400);

    const noArray = await request(app)
      .post('/api/sync')
      .set(auth(estudiante.accessToken))
      .send({ items: { tipo: 'PROGRESO' } });
    expect(noArray.status).toBe(400);

    const vacio = await request(app)
      .post('/api/sync')
      .set(auth(estudiante.accessToken))
      .send({ items: [] });
    expect(vacio.status).toBe(400);
  });

  test('solo ESTUDIANTE: sin token → 401 y TUTOR → 403', async () => {
    const tutor = await login('tutor@edulite.test', 'EduLite123!');

    const sinToken = await request(app)
      .post('/api/sync')
      .send({ items: [itemValido(1)] });
    expect(sinToken.status).toBe(401);

    const comoTutor = await request(app)
      .post('/api/sync')
      .set(auth(tutor.accessToken))
      .send({ items: [itemValido(1)] });
    expect(comoTutor.status).toBe(403);
  });

  test('un lote de ~150kb (200 ítems de respuesta larga) cabe en el límite de 200kb', async () => {
    const tutor = await login('tutor@edulite.test', 'EduLite123!');
    const estudiante = await registrar();

    const cursoRes = await request(app)
      .post('/api/cursos')
      .set(auth(tutor.accessToken))
      .send({ titulo: `Curso límite ${Date.now()}`, nivel: 'secundaria' });
    const curso = cursoRes.body.data.curso;

    await request(app)
      .patch(`/api/cursos/${curso.id}`)
      .set(auth(tutor.accessToken))
      .send({ publicado: true });

    const leccionRes = await request(app)
      .post(`/api/cursos/${curso.id}/lecciones`)
      .set(auth(tutor.accessToken))
      .send({ orden: 1, titulo: 'Lección' });
    const idLeccion = leccionRes.body.data.leccion.id;

    const evalRes = await request(app)
      .post(`/api/lecciones/${idLeccion}/evaluaciones`)
      .set(auth(tutor.accessToken))
      .send({
        pregunta: 'Pregunta de tamaño',
        opciones: ['a', 'b'],
        respuesta_correcta: 'a',
      });
    expect(evalRes.status).toBe(201);
    const idEvaluacion = evalRes.body.data.evaluacion.id;

    await request(app)
      .post(`/api/cursos/${curso.id}/inscribirse`)
      .set(auth(estudiante.accessToken));

    // 200 ítems RESPUESTA con ~500 caracteres ≈ 130kb de body
    const items = Array.from({ length: 200 }, () => ({
      tipo: 'RESPUESTA',
      idCliente: randomUUID(),
      creadoEn: PASADA(),
      idEvaluacion,
      respuesta: 'x'.repeat(500),
    }));

    const respuesta = await request(app)
      .post('/api/sync')
      .set(auth(estudiante.accessToken))
      .send({ items });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.aceptados).toHaveLength(200);
  }, 30000);
});
