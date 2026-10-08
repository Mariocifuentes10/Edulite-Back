/**
 * middlewares/auth.middleware.js
 * authMiddleware: verifica el JWT, consulta el usuario en la base de datos
 * (para que un usuario suspendido pierda acceso de inmediato) y adjunta req.user.
 * authOpcional: igual que authMiddleware, pero si NO hay token continúa sin usuario
 * (para endpoints públicos que muestran distinto contenido al dueño/admin).
 * permitirRoles(...roles): autoriza por rol; 403 si no coincide.
 */
const jwt = require('jsonwebtoken');

const env = require('../config/env');
const AppError = require('../utils/app-error');
const usuariosService = require('../modulos/usuarios/usuarios.service');

/**
 * Resuelve el usuario autenticado desde la cabecera Authorization.
 * @param {import('express').Request} req
 * @returns {Promise<Object|null>} usuario público o null si no hay cabecera
 * @throws {AppError} 401 si el token es inválido/expirado o el usuario no existe;
 *                    403 si el usuario está inactivo.
 */
async function usuarioDesdeToken(req) {
  const cabecera = req.headers.authorization || '';
  if (!cabecera.startsWith('Bearer ')) return null;

  const token = cabecera.slice(7).trim();
  if (!token) return null;

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch (err) {
    throw new AppError('Token inválido o expirado', 401);
  }

  // Consulta fresca: un usuario suspendido (activo=false) no puede seguir
  // usando un token ya emitido.
  const usuario = await usuariosService.buscarPorId(payload.sub);
  if (!usuario) throw new AppError('Token inválido o expirado', 401);
  if (!usuario.activo) {
    throw new AppError('Usuario inactivo: contacte al administrador', 403);
  }

  return {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol,
    telefono: usuario.telefono,
    activo: usuario.activo,
  };
}

/**
 * Middleware de autenticación obligatoria (Bearer JWT).
 * 401: sin token, token malformado, token inválido/expirado o usuario inexistente.
 * 403: usuario existente pero inactivo (suspendido).
 */
async function authMiddleware(req, res, next) {
  try {
    const usuario = await usuarioDesdeToken(req);
    if (!usuario) {
      return next(new AppError('Token de autenticación no proporcionado', 401));
    }
    req.user = usuario;
    return next();
  } catch (error) {
    return next(error);
  }
}

/**
 * Autenticación opcional: si hay token válido adjunta req.user; si no hay,
 * continúa con req.user indefinido. Un token inválido sigue siendo 401.
 */
async function authOpcional(req, res, next) {
  try {
    const usuario = await usuarioDesdeToken(req);
    if (usuario) req.user = usuario;
    return next();
  } catch (error) {
    return next(error);
  }
}

/**
 * Autoriza solo a los roles indicados. Usar DESPUÉS de authMiddleware.
 * @param {...('ESTUDIANTE'|'TUTOR'|'ADMIN')} roles
 * @returns {import('express').RequestHandler}
 */
function permitirRoles(...roles) {
  return function soloRoles(req, res, next) {
    if (!req.user) {
      return next(new AppError('Autenticación requerida', 401));
    }
    if (!roles.includes(req.user.rol)) {
      return next(
        new AppError('No tiene permisos para realizar esta operación', 403)
      );
    }
    return next();
  };
}

module.exports = { authMiddleware, authOpcional, permitirRoles };
