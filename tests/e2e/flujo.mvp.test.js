/**
 * tests/e2e/flujo.mvp.test.js
 * Flujo principal del MVP de punta a punta:
 *   registro → login → inscripción → sincronización offline → progreso persistido.
 * Usa el PostgreSQL embebido y el seed (tutor demo) provisto por e2e-setup.
 */
const { randomUUID } = require('crypto');

const { request, app, login, registrar, auth, crearCurso } = require('./ayudantes');

describe('Flujo MVP (registro → login → inscripción → sync)', () => {
  test('un estudiante nuevo se inscribe, sincroniza y su avance queda persistido', async () => {
    // 1. El tutor demo prepara un curso publicado con una lección y una evaluación.
    const tutor = await login('tutor@edulite.test', 'EduLite123!');
    const curso = await crearCurso({
      token: tutor.accessToken,
      nombre: `Flujo MVP ${Date.now()}`,
    });

    await request(app)
      .patch(`/api/cursos/${curso.id}`)
      .set(auth(tutor.accessToken))
      .send({ publicado: true })
      .expect(200);

    const respLeccion = await request(app)
      .post(`/api/cursos/${curso.id}/lecciones`)
      .set(auth(tutor.accessToken))
      .send({ orden: 1, titulo: 'Lección 1', contenido: 'Contenido liviano' })
      .expect(201);
    const leccion = respLeccion.body.data.leccion;

    const respEvaluacion = await request(app)
      .post(`/api/lecciones/${leccion.id}/evaluaciones`)
      .set(auth(tutor.accessToken))
      .send({ pregunta: '¿Cuánto es 2 + 2?', opciones: ['4', '5'], respuesta_correcta: '4' })
      .expect(201);
    const evaluacion = respEvaluacion.body.data.evaluacion;

    // 2. Registro y login del estudiante.
    const { usuario } = await registrar();
    const estudiante = await login(usuario.email, 'ClaveE2E123');

    // 3. Inscripción al curso publicado.
    await request(app)
      .post(`/api/cursos/${curso.id}/inscribirse`)
      .set(auth(estudiante.accessToken))
      .expect(201);

    // 4. Sincronización offline: un PROGRESO y una RESPUESTA en un lote.
    const items = [
      {
        tipo: 'PROGRESO',
        idCliente: randomUUID(),
        creadoEn: new Date().toISOString(),
        idLeccion: leccion.id,
        completada: true,
      },
      {
        tipo: 'RESPUESTA',
        idCliente: randomUUID(),
        creadoEn: new Date().toISOString(),
        idEvaluacion: evaluacion.id,
        respuesta: '4',
      },
    ];

    const sync = await request(app)
      .post('/api/sync')
      .set(auth(estudiante.accessToken))
      .send({ items })
      .expect(200);

    expect(sync.body.data.aceptados).toHaveLength(2);
    expect(sync.body.data.rechazados).toHaveLength(0);

    // 5. El avance quedó persistido (100%: única lección completada).
    const progreso = await request(app)
      .get(`/api/estudiantes/me/progreso?cursoId=${curso.id}`)
      .set(auth(estudiante.accessToken))
      .expect(200);

    expect(progreso.body.data.completadas).toBe(1);
    expect(progreso.body.data.porcentaje).toBe(100);

    // 6. Idempotencia: reenviar el mismo lote no duplica ni falla.
    const reenvio = await request(app)
      .post('/api/sync')
      .set(auth(estudiante.accessToken))
      .send({ items })
      .expect(200);

    expect(reenvio.body.data.aceptados).toHaveLength(2);
    expect(reenvio.body.data.rechazados).toHaveLength(0);
  });
});
