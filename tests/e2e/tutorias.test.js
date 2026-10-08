/**
 * tests/e2e/tutorias.test.js
 * Sprint 5 — tutorías: solicitud, listado aislado por rol, transiciones
 * de estado (tabla TRANSICIONES del service) y validación de fecha futura.
 */
const { request, app, login, registrar, auth, crearCurso } = require('./ayudantes');

const FUTURA = () => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
const PASADA = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

async function prepararEscenario() {
  const tutor = await login('tutor@edulite.test', 'EduLite123!');
  const estudiante = await registrar();

  const curso = await crearCurso({
    token: tutor.accessToken,
    nombre: `Curso tutorías ${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
  });
  await request(app)
    .patch(`/api/cursos/${curso.id}`)
    .set(auth(tutor.accessToken))
    .send({ publicado: true });
  await request(app)
    .post(`/api/cursos/${curso.id}/inscribirse`)
    .set(auth(estudiante.accessToken));

  return { tutor, estudiante, curso };
}

async function solicitar({ estudiante, tutor, curso, extra = {} }) {
  return request(app)
    .post('/api/tutorias')
    .set(auth(estudiante.accessToken))
    .send({
      idTutor: tutor.usuario.id,
      idCurso: curso.id,
      fecha: FUTURA(),
      tema: `Tema ${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      ...extra,
    });
}

/** Crea una tutoría y la lleva a REALIZADA (PENDIENTE → CONFIRMADA → REALIZADA). */
async function crearRealizada({ estudiante, tutor, curso }) {
  const creada = await solicitar({ estudiante, tutor, curso });
  expect(creada.status).toBe(201);
  const id = creada.body.data.tutoria.id;

  const confirmada = await request(app)
    .patch(`/api/tutorias/${id}/estado`)
    .set(auth(tutor.accessToken))
    .send({ estado: 'CONFIRMADA' });
  expect(confirmada.status).toBe(200);

  const realizada = await request(app)
    .patch(`/api/tutorias/${id}/estado`)
    .set(auth(tutor.accessToken))
    .send({ estado: 'REALIZADA' });
  expect(realizada.status).toBe(200);

  return id;
}

describe('Tutorías (Sprint 5)', () => {
  test('el estudiante solicita y el tutor la ve, confirma y marca como realizada', async () => {
    const { tutor, estudiante, curso } = await prepararEscenario();

    const creada = await solicitar({ estudiante, tutor, curso });
    expect(creada.status).toBe(201);
    expect(creada.body.data.tutoria.estado).toBe('PENDIENTE');
    expect(creada.body.data.tutoria.id_estudiante).toBe(estudiante.usuario.id);
    expect(creada.body.data.tutoria.id_tutor).toBe(tutor.usuario.id);

    // El estudiante ve las suyas
    const delEstudiante = await request(app)
      .get('/api/tutorias')
      .set(auth(estudiante.accessToken));
    expect(delEstudiante.status).toBe(200);
    expect(
      delEstudiante.body.data.tutorias.some((t) => t.id === creada.body.data.tutoria.id)
    ).toBe(true);

    // El tutor ve las que le piden
    const delTutor = await request(app)
      .get('/api/tutorias')
      .set(auth(tutor.accessToken));
    expect(delTutor.status).toBe(200);
    expect(
      delTutor.body.data.tutorias.some((t) => t.id === creada.body.data.tutoria.id)
    ).toBe(true);

    const id = creada.body.data.tutoria.id;

    // PENDIENTE → CONFIRMADA → REALIZADA (tutor dueño)
    const confirmada = await request(app)
      .patch(`/api/tutorias/${id}/estado`)
      .set(auth(tutor.accessToken))
      .send({ estado: 'CONFIRMADA' });
    expect(confirmada.status).toBe(200);
    expect(confirmada.body.data.tutoria.estado).toBe('CONFIRMADA');

    const realizada = await request(app)
      .patch(`/api/tutorias/${id}/estado`)
      .set(auth(tutor.accessToken))
      .send({ estado: 'REALIZADA' });
    expect(realizada.status).toBe(200);
    expect(realizada.body.data.tutoria.estado).toBe('REALIZADA');

    // Filtro por estado
    const filtradas = await request(app)
      .get('/api/tutorias?estado=REALIZADA')
      .set(auth(tutor.accessToken));
    expect(filtradas.status).toBe(200);
    expect(
      filtradas.body.data.tutorias.every((t) => t.estado === 'REALIZADA')
    ).toBe(true);
    expect(
      filtradas.body.data.tutorias.some((t) => t.id === id)
    ).toBe(true);
  });

  test('transición inválida REALIZADA → PENDIENTE devuelve 409', async () => {
    const { tutor, estudiante, curso } = await prepararEscenario();
    const id = await crearRealizada({ estudiante, tutor, curso });

    // El tutor no puede reabrir una tutoría terminada
    const tutorIntenta = await request(app)
      .patch(`/api/tutorias/${id}/estado`)
      .set(auth(tutor.accessToken))
      .send({ estado: 'PENDIENTE' });
    expect(tutorIntenta.status).toBe(409);
    expect(tutorIntenta.body.success).toBe(false);
    expect(tutorIntenta.body.message).toContain('REALIZADA → PENDIENTE');

    // Ni el estudiante tampoco (REALIZADA es estado terminal para ambos)
    const estudianteIntenta = await request(app)
      .patch(`/api/tutorias/${id}/estado`)
      .set(auth(estudiante.accessToken))
      .send({ estado: 'PENDIENTE' });
    expect(estudianteIntenta.status).toBe(409);
  });

  test('el estudiante solo puede cancelar; transiciones ajenas al rol dan 409', async () => {
    const { tutor, estudiante, curso } = await prepararEscenario();
    const creada = await solicitar({ estudiante, tutor, curso });
    const id = creada.body.data.tutoria.id;

    // ESTUDIANTE: PENDIENTE → CANCELADA permitida
    const cancelada = await request(app)
      .patch(`/api/tutorias/${id}/estado`)
      .set(auth(estudiante.accessToken))
      .send({ estado: 'CANCELADA' });
    expect(cancelada.status).toBe(200);
    expect(cancelada.body.data.tutoria.estado).toBe('CANCELADA');

    // ESTUDIANTE: no puede confirmar (409)
    const otra = await solicitar({ estudiante, tutor, curso });
    const idOtra = otra.body.data.tutoria.id;
    const confirmaEstudiante = await request(app)
      .patch(`/api/tutorias/${idOtra}/estado`)
      .set(auth(estudiante.accessToken))
      .send({ estado: 'CONFIRMADA' });
    expect(confirmaEstudiante.status).toBe(409);

    // TUTOR: PENDIENTE → REALIZADA saltando CONFIRMADA (409)
    const salta = await request(app)
      .patch(`/api/tutorias/${idOtra}/estado`)
      .set(auth(tutor.accessToken))
      .send({ estado: 'REALIZADA' });
    expect(salta.status).toBe(409);
    expect(salta.body.message).toContain('PENDIENTE → REALIZADA');
  });

  test('tutoría ajena: 404 en la lista y 403 en el cambio de estado', async () => {
    const { tutor, estudiante, curso } = await prepararEscenario();
    const creada = await solicitar({ estudiante, tutor, curso });
    const id = creada.body.data.tutoria.id;

    const otroTutor = await registrar({ rol: 'TUTOR', nombre: 'Tutor Ajeno' });
    const listaAjena = await request(app)
      .get('/api/tutorias')
      .set(auth(otroTutor.accessToken));
    expect(listaAjena.status).toBe(200);
    expect(listaAjena.body.data.tutorias.some((t) => t.id === id)).toBe(false);

    const intentoAjeno = await request(app)
      .patch(`/api/tutorias/${id}/estado`)
      .set(auth(otroTutor.accessToken))
      .send({ estado: 'CONFIRMADA' });
    expect(intentoAjeno.status).toBe(403);

    const estudianteAjeno = await registrar();
    const intentoEstudianteAjeno = await request(app)
      .patch(`/api/tutorias/${id}/estado`)
      .set(auth(estudianteAjeno.accessToken))
      .send({ estado: 'CANCELADA' });
    expect(intentoEstudianteAjeno.status).toBe(403);
  });

  test('no se puede solicitar una tutoría con fecha pasada (400)', async () => {
    const { tutor, estudiante, curso } = await prepararEscenario();

    const respuesta = await request(app)
      .post('/api/tutorias')
      .set(auth(estudiante.accessToken))
      .send({
        idTutor: tutor.usuario.id,
        idCurso: curso.id,
        fecha: PASADA(),
        tema: 'Quiero ayer',
      });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.success).toBe(false);
    expect(
      respuesta.body.errors.some((e) => e.campo === 'fecha')
    ).toBe(true);
  });

  test('solo con tutores de cursos inscritos: sin inscripción → 403', async () => {
    const { tutor, estudiante } = await prepararEscenario();

    // Otro curso del MISMO tutor donde el estudiante NO está inscrito
    const otroCurso = await crearCurso({
      token: tutor.accessToken,
      nombre: `Curso privado ${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    });
    await request(app)
      .patch(`/api/cursos/${otroCurso.id}`)
      .set(auth(tutor.accessToken))
      .send({ publicado: true });

    const sinInscripcion = await solicitar({
      estudiante,
      tutor,
      curso: otroCurso,
    });
    expect(sinInscripcion.status).toBe(403);

    // Tutor de un curso donde tampoco está inscrito → 403 aunque no pase idCurso
    const tutorAjeno = await registrar({ rol: 'TUTOR' });
    const sinIdCurso = await request(app)
      .post('/api/tutorias')
      .set(auth(estudiante.accessToken))
      .send({ idTutor: tutorAjeno.usuario.id, fecha: FUTURA(), tema: 'Alguien me ayude' });
    expect(sinIdCurso.status).toBe(403);
  });

  test('idCurso que no pertenece al tutor → 400; curso inexistente → 404', async () => {
    const { tutor, estudiante, curso } = await prepararEscenario();

    // Un segundo tutor con su curso; el estudiante pasa idCurso de un tutor
    // y idTutor de otro
    const tutorB = await registrar({ rol: 'TUTOR' });
    const cursoB = await crearCurso({
      token: tutorB.accessToken,
      nombre: `Curso B ${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    });
    await request(app)
      .patch(`/api/cursos/${cursoB.id}`)
      .set(auth(tutorB.accessToken))
      .send({ publicado: true });
    await request(app)
      .post(`/api/cursos/${cursoB.id}/inscribirse`)
      .set(auth(estudiante.accessToken));

    const cruce = await request(app)
      .post('/api/tutorias')
      .set(auth(estudiante.accessToken))
      .send({
        idTutor: tutor.usuario.id,
        idCurso: cursoB.id,
        fecha: FUTURA(),
        tema: 'Curso y tutor que no coinciden',
      });
    expect(cruce.status).toBe(400);

    const inexistente = await request(app)
      .post('/api/tutorias')
      .set(auth(estudiante.accessToken))
      .send({
        idTutor: tutor.usuario.id,
        idCurso: 999999,
        fecha: FUTURA(),
        tema: 'Curso que no existe',
      });
    expect(inexistente.status).toBe(404);

    // Tutoría válida sin idCurso: basta con estar inscrito en algún curso
    const sinCurso = await solicitar({ estudiante, tutor, curso, extra: { idCurso: undefined } });
    expect(sinCurso.status).toBe(201);
    expect(sinCurso.body.data.tutoria.id_curso).toBeNull();
  });
});
