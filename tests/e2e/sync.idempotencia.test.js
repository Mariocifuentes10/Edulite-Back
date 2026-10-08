/**
 * tests/e2e/sync.idempotencia.test.js
 * DoD Sprint 4 (1): reenviar el MISMO lote sync no duplica nada en la base
 * (progreso por PK compuesta, resultados por id_cliente) y las fechas del
 * cliente se conservan tal cual.
 */
const { randomUUID } = require('crypto');
const { Client } = require('pg');

const { request, app, login, registrar, auth, crearCurso } = require('./ayudantes');

async function consultar(sql, parametros = []) {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL });
  await cliente.connect();
  try {
    const { rows } = await cliente.query(sql, parametros);
    return rows;
  } finally {
    await cliente.end();
  }
}

async function prepararEscenario() {
  const tutor = await login('tutor@edulite.test', 'EduLite123!');
  const estudiante = await registrar();

  const curso = await crearCurso({
    token: tutor.accessToken,
    nombre: `Curso sync ${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
  });

  await request(app)
    .patch(`/api/cursos/${curso.id}`)
    .set(auth(tutor.accessToken))
    .send({ publicado: true });

  const leccionRes = await request(app)
    .post(`/api/cursos/${curso.id}/lecciones`)
    .set(auth(tutor.accessToken))
    .send({ orden: 1, titulo: 'Lección del lote' });
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
    leccion: leccionRes.body.data.leccion,
    evaluacion: evaluacionRes.body.data.evaluacion,
  };
}

function crearLote(estudiante, leccion, evaluacion) {
  const creadoEn = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  return {
    items: [
      {
        tipo: 'PROGRESO',
        idCliente: randomUUID(),
        creadoEn,
        idLeccion: leccion.id,
        completada: true,
      },
      {
        tipo: 'RESPUESTA',
        idCliente: randomUUID(),
        creadoEn,
        idEvaluacion: evaluacion.id,
        respuesta: '19',
      },
    ],
    idUsuario: estudiante.usuario.id,
    creadoEn,
  };
}

describe('POST /api/sync idempotente (Sprint 4)', () => {
  test('DoD 1: reenviar el mismo lote acepta los 2 ítems y no duplica filas', async () => {
    const { estudiante, leccion, evaluacion } = await prepararEscenario();
    const lote = crearLote(estudiante, leccion, evaluacion);
    const cuerpo = { items: lote.items };
    const [itemProgreso, itemRespuesta] = lote.items;

    // 1ª sincronización
    const primera = await request(app)
      .post('/api/sync')
      .set(auth(estudiante.accessToken))
      .send(cuerpo);
    expect(primera.status).toBe(200);
    expect(primera.body.success).toBe(true);
    expect(primera.body.data.aceptados).toEqual([
      itemProgreso.idCliente,
      itemRespuesta.idCliente,
    ]);
    expect(primera.body.data.rechazados).toEqual([]);

    // 2ª sincronización con el lote EXACTO (el navegador volvió a on-line)
    const segunda = await request(app)
      .post('/api/sync')
      .set(auth(estudiante.accessToken))
      .send(cuerpo);
    expect(segunda.status).toBe(200);
    expect(segunda.body.data.aceptados).toEqual([
      itemProgreso.idCliente,
      itemRespuesta.idCliente,
    ]);
    expect(segunda.body.data.rechazados).toEqual([]);

    // Verificación directa en la base: 1 fila de progreso, 1 resultado
    const [progreso] = await consultar(
      `SELECT COUNT(*)::int AS total FROM progreso
       WHERE id_usuario = $1 AND id_leccion = $2`,
      [lote.idUsuario, leccion.id]
    );
    expect(progreso.total).toBe(1);

    const [resultado] = await consultar(
      'SELECT COUNT(*)::int AS total FROM resultados WHERE id_cliente = $1',
      [itemRespuesta.idCliente]
    );
    expect(resultado.total).toBe(1);

    // Las fechas del cliente se conservan (no las pisa now())
    const [filaProgreso] = await consultar(
      `SELECT actualizado_en FROM progreso
       WHERE id_usuario = $1 AND id_leccion = $2`,
      [lote.idUsuario, leccion.id]
    );
    const esperada = new Date(lote.creadoEn).getTime();
    expect(
      Math.abs(new Date(filaProgreso.actualizado_en).getTime() - esperada)
    ).toBeLessThan(2000);

    const [filaResultado] = await consultar(
      'SELECT respondida_en, correcta FROM resultados WHERE id_cliente = $1',
      [itemRespuesta.idCliente]
    );
    expect(
      Math.abs(new Date(filaResultado.respondida_en).getTime() - esperada)
    ).toBeLessThan(2000);
    expect(filaResultado.correcta).toBe(true);
  });

  test('tres envíos seguidos del mismo lote siguen dejando 1 fila por ítem', async () => {
    const { estudiante, leccion, evaluacion } = await prepararEscenario();
    const lote = crearLote(estudiante, leccion, evaluacion);

    for (let i = 0; i < 3; i += 1) {
      const respuesta = await request(app)
        .post('/api/sync')
        .set(auth(estudiante.accessToken))
        .send({ items: lote.items });
      expect(respuesta.status).toBe(200);
      expect(respuesta.body.data.rechazados).toEqual([]);
    }

    const [progreso] = await consultar(
      `SELECT COUNT(*)::int AS total FROM progreso
       WHERE id_usuario = $1 AND id_leccion = $2`,
      [lote.idUsuario, leccion.id]
    );
    expect(progreso.total).toBe(1);

    const [resultados] = await consultar(
      'SELECT COUNT(*)::int AS total FROM resultados WHERE id_usuario = $1',
      [lote.idUsuario]
    );
    expect(resultados.total).toBe(1);
  });

  test('un idCliente ya registrado por OTRO usuario se rechaza (no roba resultados)', async () => {
    const { estudiante, leccion, evaluacion } = await prepararEscenario();
    const estudiante2 = await registrar();
    await request(app)
      .post('/api/sync')
      .set(auth(estudiante.accessToken))
      .send({
        items: [
          {
            tipo: 'RESPUESTA',
            idCliente: randomUUID(),
            creadoEn: new Date(Date.now() - 3600000).toISOString(),
            idEvaluacion: evaluacion.id,
            respuesta: '19',
          },
        ],
      });

    // El segundo estudiante reutiliza el MISMO idCliente (clonador del navegador)
    const idClienteTocado = await consultar(
      'SELECT id_cliente FROM resultados WHERE id_usuario = $1',
      [estudiante.usuario.id]
    );
    const reenvio = await request(app)
      .post('/api/sync')
      .set(auth(estudiante2.accessToken))
      .send({
        items: [
          {
            tipo: 'RESPUESTA',
            idCliente: idClienteTocado[0].id_cliente,
            creadoEn: new Date(Date.now() - 3600000).toISOString(),
            idEvaluacion: evaluacion.id,
            respuesta: '15',
          },
        ],
      });
    expect(reenvio.status).toBe(200);
    expect(reenvio.body.data.aceptados).toEqual([]);
    expect(reenvio.body.data.rechazados).toEqual([
      {
        idCliente: idClienteTocado[0].id_cliente,
        motivo: 'idCliente ya registrado por otro usuario',
      },
    ]);

    // El resultado sigue siendo del primer estudiante
    const [resultado] = await consultar(
      `SELECT id_usuario, respuesta FROM resultados WHERE id_cliente = $1`,
      [idClienteTocado[0].id_cliente]
    );
    expect(resultado.id_usuario).toBe(estudiante.usuario.id);
    expect(resultado.respuesta).toBe('19');
  });
});
