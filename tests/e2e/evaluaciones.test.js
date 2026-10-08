/**
 * tests/e2e/evaluaciones.test.js
 * DoD Sprint 3 (1): el endpoint de evaluaciones para estudiantes NUNCA
 * contiene respuesta_correcta. Además: validación de opciones, permisos
 * del tutor dueño y ciclo completo PATCH/DELETE.
 */
const { request, app, login, registrar, auth, crearCurso } = require('./ayudantes');

/** Curso publicado + lección + estudiante inscrito, listo para usar. */
async function prepararEscenario() {
  const tutor = await login('tutor@edulite.test', 'EduLite123!');
  // Estudiante fresco: no contamina el estado del estudiante del seed.
  const estudiante = await registrar();

  const curso = await crearCurso({
    token: tutor.accessToken,
    nombre: `Curso eval ${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
  });

  const publicado = await request(app)
    .patch(`/api/cursos/${curso.id}`)
    .set(auth(tutor.accessToken))
    .send({ publicado: true });
  expect(publicado.status).toBe(200);

  const leccionRes = await request(app)
    .post(`/api/cursos/${curso.id}/lecciones`)
    .set(auth(tutor.accessToken))
    .send({ orden: 1, titulo: 'Lección evaluable' });
  expect(leccionRes.status).toBe(201);

  const inscripcion = await request(app)
    .post(`/api/cursos/${curso.id}/inscribirse`)
    .set(auth(estudiante.accessToken));
  expect(inscripcion.status).toBe(201);

  return {
    tutor,
    estudiante,
    curso,
    leccion: leccionRes.body.data.leccion,
  };
}

const PREGUNTA_VALIDA = {
  pregunta: '¿Cuánto es 12 + 7?',
  opciones: ['19', '15', '21', '24'],
  respuesta_correcta: '19',
};

describe('Evaluaciones (Sprint 3)', () => {
  test('el TUTOR crea preguntas y la validación exige 2-4 opciones con la correcta dentro', async () => {
    const { tutor, leccion } = await prepararEscenario();
    const url = `/api/lecciones/${leccion.id}/evaluaciones`;

    const creada = await request(app)
      .post(url)
      .set(auth(tutor.accessToken))
      .send(PREGUNTA_VALIDA);
    expect(creada.status).toBe(201);
    expect(creada.body.data.evaluacion.id).toBeGreaterThan(0);
    expect(creada.body.data.evaluacion.pregunta).toBe(PREGUNTA_VALIDA.pregunta);

    // Ni siquiera al tutor se le devuelve la respuesta correcta (regla fija).
    expect(JSON.stringify(creada.body)).not.toContain('respuesta_correcta');

    // Menos de 2 opciones → 400
    const unaOpcion = await request(app)
      .post(url)
      .set(auth(tutor.accessToken))
      .send({ pregunta: 'Pregunta pobre', opciones: ['única'], respuesta_correcta: 'única' });
    expect(unaOpcion.status).toBe(400);

    // respuesta_correcta fuera de las opciones → 400
    const fueraDeOpciones = await request(app)
      .post(url)
      .set(auth(tutor.accessToken))
      .send({ pregunta: 'Pregunta trampa', opciones: ['a', 'b'], respuesta_correcta: 'z' });
    expect(fueraDeOpciones.status).toBe(400);
    expect(fueraDeOpciones.body.success).toBe(false);
  });

  test('DoD 1: GET /api/lecciones/:id/evaluaciones NUNCA expone respuesta_correcta', async () => {
    const { tutor, estudiante, leccion } = await prepararEscenario();
    const url = `/api/lecciones/${leccion.id}/evaluaciones`;

    const creada = await request(app)
      .post(url)
      .set(auth(tutor.accessToken))
      .send(PREGUNTA_VALIDA);
    expect(creada.status).toBe(201);

    const listado = await request(app)
      .get(url)
      .set(auth(estudiante.accessToken));
    expect(listado.status).toBe(200);

    // La clave prohibida no aparece NI en el objeto ni en el JSON crudo.
    expect(JSON.stringify(listado.body)).not.toContain('respuesta_correcta');

    const evaluaciones = listado.body.data.evaluaciones;
    expect(evaluaciones.length).toBeGreaterThan(0);
    for (const e of evaluaciones) {
      expect(e).not.toHaveProperty('respuesta_correcta');
      expect(e).toHaveProperty('id');
      expect(e).toHaveProperty('pregunta');
      expect(e).toHaveProperty('opciones');
      expect(Array.isArray(e.opciones)).toBe(true);
      expect(e.opciones.length).toBeGreaterThanOrEqual(2);
    }
  });

  test('solo el tutor dueño gestiona evaluaciones; el estudiante solo responde/lee', async () => {
    const { estudiante, leccion } = await prepararEscenario();
    const url = `/api/lecciones/${leccion.id}/evaluaciones`;

    // Un estudiante no puede crear preguntas (403)
    const intento = await request(app)
      .post(url)
      .set(auth(estudiante.accessToken))
      .send(PREGUNTA_VALIDA);
    expect(intento.status).toBe(403);

    // Otro tutor (no dueño) tampoco (403)
    const otroTutor = await registrar({ rol: 'TUTOR' });
    const ajena = await request(app)
      .post(url)
      .set(auth(otroTutor.accessToken))
      .send(PREGUNTA_VALIDA);
    expect(ajena.status).toBe(403);

    // Sin token → 401
    const sinToken = await request(app).get(url);
    expect(sinToken.status).toBe(401);
  });

  test('el tutor dueño actualiza y elimina; la evaluación sigue atada a su lección', async () => {
    const { tutor, estudiante, leccion } = await prepararEscenario();
    const url = `/api/lecciones/${leccion.id}/evaluaciones`;

    const creada = await request(app)
      .post(url)
      .set(auth(tutor.accessToken))
      .send(PREGUNTA_VALIDA);
    expect(creada.status).toBe(201);
    const idEvaluacion = creada.body.data.evaluacion.id;

    // PATCH: cambiar opciones exige que la respuesta vigente siga dentro
    const malPatch = await request(app)
      .patch(`${url}/${idEvaluacion}`)
      .set(auth(tutor.accessToken))
      .send({ opciones: ['a', 'b'] });
    expect(malPatch.status).toBe(400);

    const patch = await request(app)
      .patch(`${url}/${idEvaluacion}`)
      .set(auth(tutor.accessToken))
      .send({ pregunta: '¿Cuánto es 15 + 4?', respuesta_correcta: '19' });
    expect(patch.status).toBe(200);
    expect(patch.body.data.evaluacion.pregunta).toBe('¿Cuánto es 15 + 4?');
    expect(JSON.stringify(patch.body)).not.toContain('respuesta_correcta');

    // Evaluación inexistente o de otra lección → 404
    const ajena = await request(app)
      .patch('/api/lecciones/999999/evaluaciones/999999')
      .set(auth(tutor.accessToken))
      .send({ pregunta: 'Nunca' });
    expect(ajena.status).toBe(404);

    // DELETE y el estudiante deja de verla
    const borrado = await request(app)
      .delete(`${url}/${idEvaluacion}`)
      .set(auth(tutor.accessToken));
    expect(borrado.status).toBe(200);

    const listado = await request(app)
      .get(url)
      .set(auth(estudiante.accessToken));
    expect(listado.status).toBe(200);
    expect(listado.body.data.evaluaciones).toHaveLength(0);
  });
});
