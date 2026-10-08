/**
 * tests/e2e/resultados.idempotencia.test.js
 * DoD Sprint 3 (2): responder dos veces con el mismo idCliente crea UN SOLO
 * resultado en la base y devuelve la misma calificación (calificada en el
 * servidor, nunca en el cliente).
 */
const { randomUUID } = require('crypto');
const { Client } = require('pg');

const { request, app, login, registrar, auth, crearCurso } = require('./ayudantes');

async function contarResultados(filtro, parametro) {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL });
  await cliente.connect();
  try {
    const { rows } = await cliente.query(
      `SELECT COUNT(*)::int AS total FROM resultados WHERE ${filtro}`,
      [parametro]
    );
    return rows[0].total;
  } finally {
    await cliente.end();
  }
}

async function prepararEscenario() {
  const tutor = await login('tutor@edulite.test', 'EduLite123!');
  // Estudiante fresco: no contamina el estado del estudiante del seed.
  const estudiante = await registrar();

  const curso = await crearCurso({
    token: tutor.accessToken,
    nombre: `Curso respuestas ${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
  });

  await request(app)
    .patch(`/api/cursos/${curso.id}`)
    .set(auth(tutor.accessToken))
    .send({ publicado: true });

  const leccionRes = await request(app)
    .post(`/api/cursos/${curso.id}/lecciones`)
    .set(auth(tutor.accessToken))
    .send({ orden: 1, titulo: 'Lección con evaluación' });
  expect(leccionRes.status).toBe(201);

  await request(app)
    .post(`/api/cursos/${curso.id}/inscribirse`)
    .set(auth(estudiante.accessToken));

  const evaluacionRes = await request(app)
    .post(`/api/lecciones/${leccionRes.body.data.leccion.id}/evaluaciones`)
    .set(auth(tutor.accessToken))
    .send({
      pregunta: '¿Cuánto es 12 + 7?',
      opciones: ['19', '15', '21', '24'],
      respuesta_correcta: '19',
    });
  expect(evaluacionRes.status).toBe(201);

  return {
    estudiante,
    evaluacion: evaluacionRes.body.data.evaluacion,
  };
}

describe('Resultados idempotentes (Sprint 3)', () => {
  test('DoD 2: el mismo idCliente dos veces crea un solo resultado', async () => {
    const { estudiante, evaluacion } = await prepararEscenario();
    const idCliente = randomUUID();
    const url = `/api/evaluaciones/${evaluacion.id}/responder`;

    // 1ª respuesta correcta → 201
    const primera = await request(app)
      .post(url)
      .set(auth(estudiante.accessToken))
      .send({ idCliente, respuesta: '19' });
    expect(primera.status).toBe(201);
    expect(primera.body.data).toEqual({ correcta: true });

    // 2ª petición con el MISMO idCliente (incluso con otra respuesta):
    // no duplica y conserva la calificación original → 200
    const segunda = await request(app)
      .post(url)
      .set(auth(estudiante.accessToken))
      .send({ idCliente, respuesta: '15' });
    expect(segunda.status).toBe(200);
    expect(segunda.body.data).toEqual({ correcta: true });

    // Verificación directa en la base: exactamente 1 fila con ese idCliente
    const total = await contarResultados('id_cliente = $1', idCliente);
    expect(total).toBe(1);
  });

  test('la calificación se calcula en el servidor', async () => {
    const { estudiante, evaluacion } = await prepararEscenario();
    const url = `/api/evaluaciones/${evaluacion.id}/responder`;

    // Respuesta incorrecta → correcta false
    const incorrecta = await request(app)
      .post(url)
      .set(auth(estudiante.accessToken))
      .send({ idCliente: randomUUID(), respuesta: '15' });
    expect(incorrecta.status).toBe(201);
    expect(incorrecta.body.data).toEqual({ correcta: false });

    // Respuesta correcta → correcta true y así queda guardada en la base
    const correctaId = randomUUID();
    const correcta = await request(app)
      .post(url)
      .set(auth(estudiante.accessToken))
      .send({ idCliente: correctaId, respuesta: '19' });
    expect(correcta.status).toBe(201);
    expect(correcta.body.data).toEqual({ correcta: true });

    const totalCorrecta = await contarResultados('id_cliente = $1', correctaId);
    expect(totalCorrecta).toBe(1);
  });

  test('idCliente debe ser un UUID v4 y la evaluación debe existir', async () => {
    const { estudiante, evaluacion } = await prepararEscenario();

    const uuidInvalido = await request(app)
      .post(`/api/evaluaciones/${evaluacion.id}/responder`)
      .set(auth(estudiante.accessToken))
      .send({ idCliente: 'no-es-uuid', respuesta: '19' });
    expect(uuidInvalido.status).toBe(400);

    const inexistente = await request(app)
      .post('/api/evaluaciones/999999/responder')
      .set(auth(estudiante.accessToken))
      .send({ idCliente: randomUUID(), respuesta: '19' });
    expect(inexistente.status).toBe(404);
  });
});
