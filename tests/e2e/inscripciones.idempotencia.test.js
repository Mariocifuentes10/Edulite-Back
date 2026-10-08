/**
 * tests/e2e/inscripciones.idempotencia.test.js
 * DoD Sprint 2 (3): inscribirse dos veces no genera error ni duplicados.
 */
const { Client } = require('pg');

const { request, app, login, auth } = require('./ayudantes');

describe('Inscripciones idempotentes', () => {
  test('inscribirse dos veces: 201 luego 200 y una sola fila en la base', async () => {
    const estudiante = await login('estudiante@edulite.test', 'EduLite123!');

    // Primer curso publicado del catálogo (viene del seed)
    const catalogo = await request(app).get('/api/cursos?limite=1');
    expect(catalogo.status).toBe(200);
    expect(catalogo.body.data.cursos.length).toBeGreaterThan(0);
    const curso = catalogo.body.data.cursos[0];

    // 1ª inscripción -> 201
    const primera = await request(app)
      .post(`/api/cursos/${curso.id}/inscribirse`)
      .set(auth(estudiante.accessToken));
    expect(primera.status).toBe(201);
    expect(primera.body.success).toBe(true);

    // 2ª inscripción del mismo par -> 200, sin error y sin duplicar
    const segunda = await request(app)
      .post(`/api/cursos/${curso.id}/inscribirse`)
      .set(auth(estudiante.accessToken));
    expect(segunda.status).toBe(200);
    expect(segunda.body.success).toBe(true);
    expect(segunda.body.message).toContain('Ya estaba inscrito');

    // Verificación directa en la base: exactamente 1 fila
    const cliente = new Client({ connectionString: process.env.DATABASE_URL });
    await cliente.connect();
    try {
      const { rows } = await cliente.query(
        `SELECT COUNT(*)::int AS total
         FROM inscripciones
         WHERE id_curso = $1 AND id_estudiante = $2`,
        [curso.id, estudiante.usuario.id]
      );
      expect(rows[0].total).toBe(1);
    } finally {
      await cliente.end();
    }

    // Y el curso aparece en la vista del estudiante
    const misCursos = await request(app)
      .get('/api/estudiantes/me/cursos')
      .set(auth(estudiante.accessToken));
    expect(misCursos.status).toBe(200);
    const ids = misCursos.body.data.cursos.map((c) => c.id);
    expect(ids).toContain(curso.id);
  });

  test('no se puede inscribir en un curso no publicado (409)', async () => {
    const tutor = await login('tutor@edulite.test', 'EduLite123!');
    const estudiante = await login('estudiante@edulite.test', 'EduLite123!');

    const borrador = await request(app)
      .post('/api/cursos')
      .set(auth(tutor.accessToken))
      .send({ titulo: `Borrador sin publicar ${Date.now()}` });
    expect(borrador.status).toBe(201);

    const respuesta = await request(app)
      .post(`/api/cursos/${borrador.body.data.curso.id}/inscribirse`)
      .set(auth(estudiante.accessToken));
    expect(respuesta.status).toBe(409);
  });
});
