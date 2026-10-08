/**
 * tests/e2e/sync.rechazados.test.js
 * DoD Sprint 4 (2): un lote MIXTO acepta los ítems válidos y deja los
 * inválidos en "rechazados" con su motivo, sin tumbar el lote completo.
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
    nombre: `Curso sync mixto ${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
  });

  await request(app)
    .patch(`/api/cursos/${curso.id}`)
    .set(auth(tutor.accessToken))
    .send({ publicado: true });

  const leccionRes = await request(app)
    .post(`/api/cursos/${curso.id}/lecciones`)
    .set(auth(tutor.accessToken))
    .send({ orden: 1, titulo: 'Lección válida' });
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
    tutor,
    estudiante,
    curso,
    leccion: leccionRes.body.data.leccion,
    evaluacion: evaluacionRes.body.data.evaluacion,
  };
}

const PASADA = () => new Date(Date.now() - 3600000).toISOString();
const FUTURA = () => new Date(Date.now() + 24 * 3600000).toISOString();

describe('POST /api/sync con ítems rechazados (Sprint 4)', () => {
  test('DoD 2: lote mixto acepta los válidos y motiva cada rechazo', async () => {
    const { estudiante, leccion, evaluacion } = await prepararEscenario();

    const validoProgreso = {
      tipo: 'PROGRESO',
      idCliente: randomUUID(),
      creadoEn: PASADA(),
      idLeccion: leccion.id,
      completada: true,
    };
    const leccionInexistente = {
      tipo: 'PROGRESO',
      idCliente: randomUUID(),
      creadoEn: PASADA(),
      idLeccion: 999999,
      completada: true,
    };
    const validoRespuesta = {
      tipo: 'RESPUESTA',
      idCliente: randomUUID(),
      creadoEn: PASADA(),
      idEvaluacion: evaluacion.id,
      respuesta: '19',
    };
    const evaluacionInexistente = {
      tipo: 'RESPUESTA',
      idCliente: randomUUID(),
      creadoEn: PASADA(),
      idEvaluacion: 999999,
      respuesta: '19',
    };
    const fechaFutura = {
      tipo: 'PROGRESO',
      idCliente: randomUUID(),
      creadoEn: FUTURA(),
      idLeccion: leccion.id,
      completada: true,
    };
    const tipoInvalido = {
      tipo: 'EXAMEN',
      idCliente: randomUUID(),
      creadoEn: PASADA(),
    };

    const respuesta = await request(app)
      .post('/api/sync')
      .set(auth(estudiante.accessToken))
      .send({
        items: [
          validoProgreso,
          leccionInexistente,
          validoRespuesta,
          evaluacionInexistente,
          fechaFutura,
          tipoInvalido,
        ],
      });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.success).toBe(true);

    // Aceptados: solo los dos ítems válidos, en orden
    expect(respuesta.body.data.aceptados).toEqual([
      validoProgreso.idCliente,
      validoRespuesta.idCliente,
    ]);

    // Rechazados: cada ítem inválido con su motivo, no tumba el lote
    expect(respuesta.body.data.rechazados).toEqual([
      {
        idCliente: leccionInexistente.idCliente,
        motivo: 'Lección no encontrada',
      },
      {
        idCliente: evaluacionInexistente.idCliente,
        motivo: 'Evaluación no encontrada',
      },
      {
        idCliente: fechaFutura.idCliente,
        motivo: 'creadoEn no puede ser futura',
      },
      {
        idCliente: tipoInvalido.idCliente,
        motivo: 'tipo debe ser PROGRESO o RESPUESTA',
      },
    ]);

    // Solo los ítems aceptados escribieron en la base
    const [progreso] = await consultar(
      `SELECT COUNT(*)::int AS total FROM progreso
       WHERE id_usuario = $1 AND id_leccion = $2`,
      [estudiante.usuario.id, leccion.id]
    );
    expect(progreso.total).toBe(1);

    const resultados = await consultar(
      'SELECT id_cliente FROM resultados WHERE id_usuario = $1',
      [estudiante.usuario.id]
    );
    expect(resultados.map((r) => r.id_cliente)).toEqual([
      validoRespuesta.idCliente,
    ]);

    const rechazadosEnBase = await consultar(
      `SELECT COUNT(*)::int AS total FROM resultados
       WHERE id_cliente = ANY($1::uuid[])`,
      [
        [
          leccionInexistente.idCliente,
          evaluacionInexistente.idCliente,
          fechaFutura.idCliente,
          tipoInvalido.idCliente,
        ],
      ]
    );
    expect(rechazadosEnBase[0].total).toBe(0);
  });

  test('un idCliente repetido dentro del mismo lote solo procesa el primero', async () => {
    const { estudiante, leccion } = await prepararEscenario();
    const idCliente = randomUUID();

    const respuesta = await request(app)
      .post('/api/sync')
      .set(auth(estudiante.accessToken))
      .send({
        items: [
          {
            tipo: 'PROGRESO',
            idCliente,
            creadoEn: PASADA(),
            idLeccion: leccion.id,
            completada: true,
          },
          {
            tipo: 'PROGRESO',
            idCliente,
            creadoEn: PASADA(),
            idLeccion: leccion.id,
            completada: false,
          },
        ],
      });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.aceptados).toEqual([idCliente]);
    expect(respuesta.body.data.rechazados).toEqual([
      { idCliente, motivo: 'idCliente repetido en el lote' },
    ]);

    // El primero ganó: la lección queda completada
    const [progreso] = await consultar(
      `SELECT completada FROM progreso
       WHERE id_usuario = $1 AND id_leccion = $2`,
      [estudiante.usuario.id, leccion.id]
    );
    expect(progreso.completada).toBe(true);
  });

  test('estudiante NO inscrito: el ítem se rechaza con motivo 403', async () => {
    const { leccion, evaluacion } = await prepararEscenario();
    const ajeno = await registrar();

    const respuesta = await request(app)
      .post('/api/sync')
      .set(auth(ajeno.accessToken))
      .send({
        items: [
          {
            tipo: 'PROGRESO',
            idCliente: randomUUID(),
            creadoEn: PASADA(),
            idLeccion: leccion.id,
            completada: true,
          },
          {
            tipo: 'RESPUESTA',
            idCliente: randomUUID(),
            creadoEn: PASADA(),
            idEvaluacion: evaluacion.id,
            respuesta: '19',
          },
        ],
      });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.aceptados).toEqual([]);
    expect(respuesta.body.data.rechazados).toHaveLength(2);
    expect(respuesta.body.data.rechazados[0].motivo).toBe(
      'No está inscrito en el curso de esta lección'
    );
    expect(respuesta.body.data.rechazados[1].motivo).toBe(
      'No está inscrito en el curso de esta evaluación'
    );
  });

  test('ítems con forma inválida se rechazan uno a uno sin detener el lote', async () => {
    const { estudiante, leccion } = await prepararEscenario();

    const respuesta = await request(app)
      .post('/api/sync')
      .set(auth(estudiante.accessToken))
      .send({
        items: [
          { tipo: 'PROGRESO', idCliente: 'no-es-uuid', creadoEn: PASADA(), idLeccion: leccion.id, completada: true },
          { tipo: 'PROGRESO', idCliente: randomUUID(), creadoEn: 'ayer-no-es-fecha', idLeccion: leccion.id, completada: true },
          { tipo: 'PROGRESO', idCliente: randomUUID(), creadoEn: PASADA(), idLeccion: 'uno', completada: true },
          { tipo: 'PROGRESO', idCliente: randomUUID(), creadoEn: PASADA(), idLeccion: leccion.id, completada: 'si' },
          { tipo: 'RESPUESTA', idCliente: randomUUID(), creadoEn: PASADA(), idEvaluacion: 1, respuesta: '' },
          {
            tipo: 'PROGRESO',
            idCliente: randomUUID(),
            creadoEn: PASADA(),
            idLeccion: leccion.id,
            completada: true,
          },
        ],
      });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.aceptados).toHaveLength(1);
    expect(respuesta.body.data.rechazados).toHaveLength(5);

    const motivos = respuesta.body.data.rechazados.map((r) => r.motivo);
    expect(motivos).toContain('idCliente debe ser un UUID v4');
    expect(motivos).toContain('creadoEn debe ser una fecha ISO-8601 válida');
    expect(motivos).toContain('idLeccion debe ser un entero >= 1');
    expect(motivos).toContain('completada debe ser true o false');
    expect(motivos).toContain('respuesta es obligatoria');
  });
});
