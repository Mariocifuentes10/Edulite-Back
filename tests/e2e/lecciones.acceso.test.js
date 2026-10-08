/**
 * tests/e2e/lecciones.acceso.test.js
 * DoD Sprint 2 (2): un estudiante no inscrito no puede leer las lecciones (403).
 */
const { request, app, login, auth, crearCurso } = require('./ayudantes');

describe('Acceso a lecciones', () => {
  let curso;
  let leccion;

  beforeAll(async () => {
    const tutor = await login('tutor@edulite.test', 'EduLite123!');

    curso = await crearCurso({
      token: tutor.accessToken,
      nombre: `Curso lecciones ${Date.now()}`,
    });

    // Publicarlo: inscribirse solo permitido en cursos publicados.
    const publicado = await request(app)
      .patch(`/api/cursos/${curso.id}`)
      .set(auth(tutor.accessToken))
      .send({ publicado: true });
    expect(publicado.status).toBe(200);

    const creada = await request(app)
      .post(`/api/cursos/${curso.id}/lecciones`)
      .set(auth(tutor.accessToken))
      .send({
        orden: 1,
        titulo: 'Lección protegida',
        contenido: 'Contenido que solo ven los inscritos.',
      });
    expect(creada.status).toBe(201);
    leccion = creada.body.data.leccion;
  });

  test('un estudiante NO inscrito recibe 403 al leer las lecciones', async () => {
    const estudiante = await login('estudiante@edulite.test', 'EduLite123!');

    // Lista de lecciones del curso -> 403
    const lista = await request(app)
      .get(`/api/cursos/${curso.id}/lecciones`)
      .set(auth(estudiante.accessToken));
    expect(lista.status).toBe(403);
    expect(lista.body.success).toBe(false);

    // Lección individual -> 403
    const individual = await request(app)
      .get(`/api/lecciones/${leccion.id}`)
      .set(auth(estudiante.accessToken));
    expect(individual.status).toBe(403);
    expect(individual.body.success).toBe(false);
  });

  test('la lista de lecciones nunca incluye el campo contenido', async () => {
    const tutor = await login('tutor@edulite.test', 'EduLite123!');

    const lista = await request(app)
      .get(`/api/cursos/${curso.id}/lecciones`)
      .set(auth(tutor.accessToken));

    expect(lista.status).toBe(200);
    const lecciones = lista.body.data.lecciones;
    expect(lecciones.length).toBeGreaterThan(0);
    for (const item of lecciones) {
      expect(item).not.toHaveProperty('contenido');
      expect(item).toEqual(
        expect.objectContaining({ id: expect.any(Number), orden: 1 })
      );
    }
  });

  test('el orden no se repite dentro de un curso (409)', async () => {
    const tutor = await login('tutor@edulite.test', 'EduLite123!');

    const repetida = await request(app)
      .post(`/api/cursos/${curso.id}/lecciones`)
      .set(auth(tutor.accessToken))
      .send({ orden: 1, titulo: 'Otra con el mismo orden' });

    expect(repetida.status).toBe(409);
    expect(repetida.body.success).toBe(false);
  });

  test('tras inscribirse, el estudiante sí puede leer las lecciones', async () => {
    const estudiante = await login('estudiante@edulite.test', 'EduLite123!');

    const inscripcion = await request(app)
      .post(`/api/cursos/${curso.id}/inscribirse`)
      .set(auth(estudiante.accessToken));
    expect(inscripcion.status).toBe(201);

    const lista = await request(app)
      .get(`/api/cursos/${curso.id}/lecciones`)
      .set(auth(estudiante.accessToken));
    expect(lista.status).toBe(200);

    const individual = await request(app)
      .get(`/api/lecciones/${leccion.id}`)
      .set(auth(estudiante.accessToken));
    expect(individual.status).toBe(200);
    expect(individual.body.data.leccion.contenido).toContain(
      'solo ven los inscritos'
    );
  });
});
