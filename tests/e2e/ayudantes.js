/**
 * tests/e2e/ayudantes.js
 * Utilidades compartidas de los tests e2e (supertest contra la app real).
 */
const request = require('supertest');
const app = require('../../app');

/**
 * Inicia sesión y devuelve { accessToken, usuario }.
 */
async function login(email, password) {
  const respuesta = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  if (respuesta.status !== 200) {
    throw new Error(
      `Login falló (${respuesta.status}): ${JSON.stringify(respuesta.body)}`
    );
  }
  return respuesta.body.data;
}

/**
 * Registra un usuario nuevo con email único (evita colisiones entre tests).
 */
async function registrar(overrides = {}) {
  const email =
    overrides.email ||
    `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`;

  const respuesta = await request(app).post('/api/auth/register').send({
    nombre: 'Usuario E2E',
    email,
    password: 'ClaveE2E123',
    rol: 'ESTUDIANTE',
    ...overrides,
  });

  if (respuesta.status !== 201) {
    throw new Error(
      `Registro falló (${respuesta.status}): ${JSON.stringify(respuesta.body)}`
    );
  }
  return respuesta.body.data;
}

/** Cabecera Authorization para supertest. */
function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

/** Crea un curso con título único para el tutor dado. */
async function crearCurso({ token, nombre }) {
  const respuesta = await request(app)
    .post('/api/cursos')
    .set(auth(token))
    .send({ titulo: nombre, nivel: 'secundaria' });

  if (respuesta.status !== 201) {
    throw new Error(
      `Crear curso falló (${respuesta.status}): ${JSON.stringify(respuesta.body)}`
    );
  }
  return respuesta.body.data.curso;
}

module.exports = { request, app, login, registrar, auth, crearCurso };
