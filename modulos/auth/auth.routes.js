/**
 * modulos/auth/auth.routes.js
 * Rutas de autenticación bajo /api/auth.
 * Cadena por ruta: validaciones (express-validator) → validar → asyncHandler → controller.
 */
const { Router } = require('express');

const asyncHandler = require('../../utils/async-handler');
const validar = require('../../middlewares/validar.middleware');
const { authMiddleware } = require('../../middlewares/auth.middleware');

const { validacionesRegistro, validacionesLogin } = require('./auth.validators');
const authController = require('./auth.controller');

const router = Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Autenticación]
 *     summary: Registra un usuario nuevo (solo ESTUDIANTE o TUTOR)
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre, email, password, rol]
 *             properties:
 *               nombre:
 *                 type: string
 *                 maxLength: 120
 *                 example: María Pérez
 *               email:
 *                 type: string
 *                 format: email
 *                 example: maria@ejemplo.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: Segura123
 *               rol:
 *                 type: string
 *                 enum: [ESTUDIANTE, TUTOR]
 *                 example: ESTUDIANTE
 *               telefono:
 *                 type: string
 *                 nullable: true
 *                 example: "+56 9 1234 5678"
 *     responses:
 *       '201':
 *         description: Usuario creado; devuelve accessToken y datos públicos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RespuestaAuth'
 *       '400':
 *         description: Datos inválidos (password < 8, rol ADMIN, email con formato incorrecto)
 *       '409':
 *         description: El email ya está registrado
 */
router.post(
  '/register',
  validacionesRegistro,
  validar,
  asyncHandler(authController.register)
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Autenticación]
 *     summary: Inicia sesión y devuelve un JWT
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: estudiante@edulite.test
 *               password:
 *                 type: string
 *                 example: EduLite123!
 *     responses:
 *       '200':
 *         description: Credenciales correctas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RespuestaAuth'
 *       '401':
 *         description: Credenciales inválidas (email inexistente o contraseña incorrecta)
 *       '403':
 *         description: Usuario inactivo (suspendido)
 */
router.post(
  '/login',
  validacionesLogin,
  validar,
  asyncHandler(authController.login)
);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     tags: [Autenticación]
 *     summary: Devuelve el usuario autenticado (requiere Bearer token)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Sesión activa
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     usuario:
 *                       $ref: '#/components/schemas/Usuario'
 *                 message:
 *                   type: string
 *                   example: Sesión activa
 *       '401':
 *         description: Sin token, token inválido o token expirado
 *       '403':
 *         description: Usuario inactivo
 */
router.get('/me', authMiddleware, asyncHandler(authController.me));

module.exports = router;
