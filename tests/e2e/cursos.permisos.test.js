/**
 * tests/e2e/cursos.permisos.test.js
 * DoD Sprint 2 (1): un tutor no puede editar ni borrar el curso de otro (403).
 */
const { request, app, login, registrar, auth, crearCurso } = require('./ayudantes');

describe('Permisos de cursos entre tutores', () => {
  test('un tutor no puede editar ni borrar el curso de otro tutor (403)', async () => {
    const tutorA = await login('tutor@edulite.test', 'EduLite123!');
    const tutorB = await registrar({ rol: 'TUTOR', nombre: 'Tutor B E2E' });

    const curso = await crearCurso({
      token: tutorA.accessToken,
      nombre: `Curso protegido ${Date.now()}`,
    });

    // (1) El tutor B intenta EDITAR el curso de A -> 403
    const edicion = await request(app)
      .patch(`/api/cursos/${curso.id}`)
      .set(auth(tutorB.accessToken))
      .send({ titulo: 'Titulo ajeno' });
    expect(edicion.status).toBe(403);
    expect(edicion.body.success).toBe(false);

    // (1) El tutor B intenta BORRAR el curso de A -> 403
    const borrado = await request(app)
      .delete(`/api/cursos/${curso.id}`)
      .set(auth(tutorB.accessToken));
    expect(borrado.status).toBe(403);
    expect(borrado.body.success).toBe(false);

    // Control: el dueño A sí puede editar (y publicar)
    const edicionPropia = await request(app)
      .patch(`/api/cursos/${curso.id}`)
      .set(auth(tutorA.accessToken))
      .send({ descripcion: 'Actualizado por su dueño', publicado: true });
    expect(edicionPropia.status).toBe(200);
    expect(edicionPropia.body.data.curso.publicado).toBe(true);

    // El curso sigue intacto y ahora es visible en el catálogo público
    const detalle = await request(app).get(`/api/cursos/${curso.id}`);
    expect(detalle.status).toBe(200);
    expect(detalle.body.data.curso.titulo).toBe(curso.titulo);
    expect(detalle.body.data.curso.descripcion).toBe('Actualizado por su dueño');
  });

  test('un estudiante no puede crear cursos (403 por rol)', async () => {
    const estudiante = await login('estudiante@edulite.test', 'EduLite123!');

    const respuesta = await request(app)
      .post('/api/cursos')
      .set(auth(estudiante.accessToken))
      .send({ titulo: 'Curso de estudiante' });

    expect(respuesta.status).toBe(403);
  });

  test('un curso borrador no es visible para otros (404)', async () => {
    const tutorA = await login('tutor@edulite.test', 'EduLite123!');
    const tutorB = await registrar({ rol: 'TUTOR', nombre: 'Tutor Borrador' });

    const borrador = await crearCurso({
      token: tutorA.accessToken,
      nombre: `Borrador ${Date.now()}`,
    });
    expect(borrador.publicado).toBe(false);

    // El dueño sí lo ve
    const dueno = await request(app)
      .get(`/api/cursos/${borrador.id}`)
      .set(auth(tutorA.accessToken));
    expect(dueno.status).toBe(200);

    // Otro tutor: 404 (no revelar existencia)
    const ajeno = await request(app)
      .get(`/api/cursos/${borrador.id}`)
      .set(auth(tutorB.accessToken));
    expect(ajeno.status).toBe(404);
  });
});
