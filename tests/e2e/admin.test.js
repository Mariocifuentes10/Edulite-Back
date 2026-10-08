/**
 * tests/e2e/admin.test.js
 * Panel de administración: listado con filtro por rol, guards, suspensión
 * efectiva (login y token previo), reactivación y auto-suspensión bloqueada.
 */
const { request, app, login, registrar, auth } = require('./ayudantes');

const CLAVE_DEMO = 'EduLite123!';

async function loginAdmin() {
  return login('admin@edulite.test', CLAVE_DEMO);
}

describe('Módulo admin', () => {
  test('lista usuarios paginados sin password_hash y filtra por rol', async () => {
    const admin = await loginAdmin();

    const respuesta = await request(app)
      .get('/api/admin/usuarios?limite=50')
      .set(auth(admin.accessToken))
      .expect(200);

    const { usuarios, total, pagina, limite, totalPaginas } = respuesta.body.data;
    expect(Array.isArray(usuarios)).toBe(true);
    expect(total).toBeGreaterThanOrEqual(3);
    expect(pagina).toBe(1);
    expect(limite).toBe(50);
    expect(totalPaginas).toBeGreaterThanOrEqual(1);
    usuarios.forEach((u) => {
      expect(u).not.toHaveProperty('password_hash');
      expect(u).toHaveProperty('activo');
    });

    const soloAdmins = await request(app)
      .get('/api/admin/usuarios?rol=ADMIN')
      .set(auth(admin.accessToken))
      .expect(200);
    expect(soloAdmins.body.data.usuarios.length).toBeGreaterThanOrEqual(1);
    soloAdmins.body.data.usuarios.forEach((u) => expect(u.rol).toBe('ADMIN'));
  });

  test('un rol distinto de ADMIN recibe 403', async () => {
    const estudiante = await registrar();

    await request(app)
      .get('/api/admin/usuarios')
      .set(auth(estudiante.accessToken))
      .expect(403);

    await request(app)
      .get('/api/admin/estadisticas')
      .set(auth(estudiante.accessToken))
      .expect(403);
  });

  test('suspender bloquea login y el token ya emitido; reactivar lo restaura', async () => {
    const admin = await loginAdmin();
    const { accessToken, usuario } = await registrar();

    // Token válido antes de suspender.
    await request(app).get('/api/auth/me').set(auth(accessToken)).expect(200);

    const suspender = await request(app)
      .patch(`/api/admin/usuarios/${usuario.id}/activo`)
      .set(auth(admin.accessToken))
      .send({ activo: false })
      .expect(200);
    expect(suspender.body.data.usuario.activo).toBe(false);

    // El login se rechaza.
    await request(app)
      .post('/api/auth/login')
      .send({ email: usuario.email, password: 'ClaveE2E123' })
      .expect(403);

    // El token emitido antes deja de servir de inmediato.
    await request(app).get('/api/auth/me').set(auth(accessToken)).expect(403);

    // Reactivar.
    const activar = await request(app)
      .patch(`/api/admin/usuarios/${usuario.id}/activo`)
      .set(auth(admin.accessToken))
      .send({ activo: true })
      .expect(200);
    expect(activar.body.data.usuario.activo).toBe(true);

    await request(app)
      .post('/api/auth/login')
      .send({ email: usuario.email, password: 'ClaveE2E123' })
      .expect(200);
  });

  test('un admin no puede suspender su propia cuenta', async () => {
    const admin = await loginAdmin();

    const respuesta = await request(app)
      .patch(`/api/admin/usuarios/${admin.usuario.id}/activo`)
      .set(auth(admin.accessToken))
      .send({ activo: false })
      .expect(400);

    expect(respuesta.body.message).toMatch(/propia cuenta/i);
  });

  test('404 al intentar cambiar el estado de un usuario inexistente', async () => {
    const admin = await loginAdmin();

    await request(app)
      .patch('/api/admin/usuarios/999999/activo')
      .set(auth(admin.accessToken))
      .send({ activo: false })
      .expect(404);
  });

  test('400 si activo no es booleano', async () => {
    const admin = await loginAdmin();

    await request(app)
      .patch(`/api/admin/usuarios/${admin.usuario.id}/activo`)
      .set(auth(admin.accessToken))
      .send({ activo: 'quizás' })
      .expect(400);
  });

  test('estadísticas globales con el contrato esperado', async () => {
    const admin = await loginAdmin();

    const respuesta = await request(app)
      .get('/api/admin/estadisticas')
      .set(auth(admin.accessToken))
      .expect(200);

    const datos = respuesta.body.data;
    expect(Array.isArray(datos.usuariosPorRol)).toBe(true);
    expect(datos.usuariosPorRol.length).toBeGreaterThanOrEqual(1);
    expect(typeof datos.cursosPublicados).toBe('number');
    expect(typeof datos.leccionesCompletadas).toBe('number');
    expect(Array.isArray(datos.topCursos)).toBe(true);
  });
});
