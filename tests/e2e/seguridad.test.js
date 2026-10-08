/**
 * tests/e2e/seguridad.test.js
 * Cabeceras de seguridad (helmet), ausencia de x-powered-by, envelope de
 * errores y comportamiento del rate-limit en tests (desactivado).
 */
const { request, app } = require('./ayudantes');

describe('Seguridad', () => {
  test('GET /api/salud responde el envelope esperado', async () => {
    const respuesta = await request(app).get('/api/salud').expect(200);

    expect(respuesta.body).toEqual({
      success: true,
      data: { estado: 'ok' },
      message: 'API EduLite funcionando',
    });
  });

  test('helmet aplica cabeceras de seguridad y x-powered-by está ausente', async () => {
    const respuesta = await request(app).get('/api/salud').expect(200);

    expect(respuesta.headers['x-powered-by']).toBeUndefined();
    expect(respuesta.headers['x-content-type-options']).toBe('nosniff');
    expect(respuesta.headers['x-frame-options']).toBeDefined();
    expect(respuesta.headers['referrer-policy']).toBeDefined();
  });

  test('una ruta inexistente responde 404 con success:false', async () => {
    const respuesta = await request(app).get('/api/no-existe').expect(404);

    expect(respuesta.body.success).toBe(false);
    expect(respuesta.body.message).toBeDefined();
  });

  test('un endpoint protegido sin token responde 401', async () => {
    await request(app).get('/api/admin/usuarios').expect(401);
  });

  test('el rate-limit está desactivado en tests (no hay 429 tras muchas peticiones)', async () => {
    // Muy por encima del límite global (100/min): en test no debe activarse.
    for (let i = 0; i < 110; i += 1) {
      const respuesta = await request(app).get('/api/salud');
      expect(respuesta.status).toBe(200);
    }
  });
});
