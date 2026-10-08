/**
 * tests/e2e/cache.compresion.test.js
 * Sprint 4 (red): compresión gzip en respuestas grandes (bajo consumo de
 * datos) y Cache-Control razonable en los GET de cursos y lecciones.
 */
const { request, app, login, registrar, auth } = require('./ayudantes');

async function prepararEscenario() {
  const tutor = await login('tutor@edulite.test', 'EduLite123!');
  const estudiante = await registrar();

  const cursoRes = await request(app)
    .post('/api/cursos')
    .set(auth(tutor.accessToken))
    .send({
      titulo: `Curso compresión ${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      // Descripción larga: fuerza una respuesta > 1kb para ejercitar gzip.
      descripcion: 'Descripción extensa. '.repeat(90),
      nivel: 'secundaria',
    });
  expect(cursoRes.status).toBe(201);
  const curso = cursoRes.body.data.curso;

  await request(app)
    .patch(`/api/cursos/${curso.id}`)
    .set(auth(tutor.accessToken))
    .send({ publicado: true });

  const leccionRes = await request(app)
    .post(`/api/cursos/${curso.id}/lecciones`)
    .set(auth(tutor.accessToken))
    .send({
      orden: 1,
      titulo: 'Lección con contenido',
      contenido: 'Contenido de la lección. '.repeat(30),
    });
  expect(leccionRes.status).toBe(201);

  await request(app)
    .post(`/api/cursos/${curso.id}/inscribirse`)
    .set(auth(estudiante.accessToken));

  return { tutor, estudiante, curso, leccion: leccionRes.body.data.leccion };
}

describe('Compresión y Cache-Control (Sprint 4)', () => {
  test('GET /api/cursos responde con gzip y Cache-Control público (5 min)', async () => {
    const { curso } = await prepararEscenario();

    const respuesta = await request(app)
      .get('/api/cursos?limite=50')
      .set('Accept-Encoding', 'gzip');

    expect(respuesta.status).toBe(200);
    // Bajo consumo de datos: la respuesta grande viaja comprimida
    expect(respuesta.headers['content-encoding']).toBe('gzip');
    // Catálogo público: cacheable por proxies/CDN
    expect(respuesta.headers['cache-control']).toBe('public, max-age=300');

    // El cliente sigue recibiendo el JSON descomprimido y completo
    const cursoPrueba = respuesta.body.data.cursos.find((c) => c.id === curso.id);
    expect(cursoPrueba).toBeDefined();
    expect(cursoPrueba.descripcion).toHaveLength('Descripción extensa. '.repeat(90).length);
  });

  test('GET /api/cursos sin gzip pedido NO envía Content-Encoding', async () => {
    const respuesta = await request(app)
      .get('/api/cursos?limite=50')
      .set('Accept-Encoding', 'identity');

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers['content-encoding']).toBeUndefined();
    expect(respuesta.headers['cache-control']).toBe('public, max-age=300');
  });

  test('detalle de curso: Cache-Control privado (varía con Authorization)', async () => {
    const { curso } = await prepararEscenario();

    // Público (curso publicado, sin token)
    const anonimo = await request(app).get(`/api/cursos/${curso.id}`);
    expect(anonimo.status).toBe(200);
    expect(anonimo.headers['cache-control']).toBe('private, max-age=60');

    // Con token también es privado: la respuesta puede variar por usuario
    const estudiante = await registrar();
    const autenticado = await request(app)
      .get(`/api/cursos/${curso.id}`)
      .set(auth(estudiante.accessToken));
    expect(autenticado.status).toBe(200);
    expect(autenticado.headers['cache-control']).toBe('private, max-age=60');
  });

  test('los GET de lecciones envían Cache-Control privado (60 s)', async () => {
    const { estudiante, curso, leccion } = await prepararEscenario();

    const lista = await request(app)
      .get(`/api/cursos/${curso.id}/lecciones`)
      .set(auth(estudiante.accessToken));
    expect(lista.status).toBe(200);
    expect(lista.headers['cache-control']).toBe('private, max-age=60');

    const detalle = await request(app)
      .get(`/api/lecciones/${leccion.id}`)
      .set(auth(estudiante.accessToken));
    expect(detalle.status).toBe(200);
    expect(detalle.headers['cache-control']).toBe('private, max-age=60');
  });

  test('las respuestas de error NUNCA se cachean', async () => {
    const noEncontrado = await request(app).get('/api/cursos/999999');
    expect(noEncontrado.status).toBe(404);
    expect(noEncontrado.headers['cache-control']).toBeUndefined();

    const sinToken = await request(app).get('/api/lecciones/1');
    expect(sinToken.status).toBe(401);
    expect(sinToken.headers['cache-control']).toBeUndefined();

    const validacion = await request(app).get('/api/cursos?pagina=0');
    expect(validacion.status).toBe(400);
    expect(validacion.headers['cache-control']).toBeUndefined();
  });
});
