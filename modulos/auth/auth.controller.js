/**
 * modulos/auth/auth.controller.js
 * Controlador de autenticación: solo orquesta validación → service → respuesta.
 * Sin SQL ni lógica de negocio aquí (regla del proyecto).
 */
const authService = require('./auth.service');
const { ok } = require('../../utils/respuesta');

/**
 * POST /api/auth/register
 */
async function register(req, res) {
  const resultado = await authService.registrar({
    nombre: req.body.nombre,
    email: req.body.email,
    password: req.body.password,
    rol: req.body.rol,
    telefono: req.body.telefono || null,
  });

  return ok(res, resultado, 'Usuario registrado correctamente', 201);
}

/**
 * POST /api/auth/login
 */
async function login(req, res) {
  const resultado = await authService.iniciarSesion(
    req.body.email,
    req.body.password
  );

  return ok(res, resultado, 'Inicio de sesión exitoso');
}

/**
 * GET /api/auth/me
 * req.user ya fue cargado y verificado por authMiddleware.
 */
async function me(req, res) {
  return ok(res, { usuario: req.user }, 'Sesión activa');
}

module.exports = { register, login, me };
