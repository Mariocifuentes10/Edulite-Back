/**
 * modulos/auth/auth.service.js
 * Lógica de negocio de autenticación: registro, login y emisión de JWT.
 * El SQL vive en usuarios.service; aquí solo se orquesta.
 */
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const env = require('../../config/env');
const AppError = require('../../utils/app-error');
const usuariosService = require('../usuarios/usuarios.service');
const { ROLES_PUBLICOS } = require('./auth.validators');

/** Columnas del usuario que sí se devuelven al cliente. */
const DATOS_PUBLICOS = ['id', 'nombre', 'email', 'rol'];

/**
 * Reduce un usuario a sus datos públicos (garantía de que password_hash
 * nunca sale en una respuesta JSON).
 * @param {Object} usuario
 * @returns {{ id:number, nombre:string, email:string, rol:string }}
 */
function datosPublicos(usuario) {
  const salida = {};
  for (const campo of DATOS_PUBLICOS) {
    if (usuario[campo] !== undefined) salida[campo] = usuario[campo];
  }
  return salida;
}

/**
 * Firma un JWT con el payload mínimo { sub, rol }.
 * @param {Object} usuario
 * @returns {string}
 */
function generarToken(usuario) {
  return jwt.sign(
    { sub: usuario.id, rol: usuario.rol },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

/**
 * Registra un usuario nuevo.
 * Defensa en profundidad: aunque el validador de la ruta ya restringe los roles,
 * aquí se vuelve a bloquear ADMIN por si alguien invoca el servicio directamente.
 *
 * @param {Object} datos - { nombre, email, password, rol, telefono }
 * @returns {Promise<{ accessToken:string, usuario:Object }>}
 */
async function registrar(datos) {
  if (!ROLES_PUBLICOS.includes(datos.rol)) {
    throw new AppError('El rol debe ser ESTUDIANTE o TUTOR', 400);
  }

  const usuario = await usuariosService.crear(datos);

  return {
    accessToken: generarToken(usuario),
    usuario: datosPublicos(usuario),
  };
}

/**
 * Valida credenciales y emite un token.
 * - Credenciales incorrectas (usuario inexistente o contraseña inválida) -> 401
 *   con el MISMO mensaje, para no revelar si el email existe.
 * - Usuario con contraseña correcta pero inactivo -> 403.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ accessToken:string, usuario:Object }>}
 */
async function iniciarSesion(email, password) {
  const usuario = await usuariosService.buscarParaLogin(email);

  // Mensaje único para "no existe" y "contraseña incorrecta" (anti-enumeración).
  const credencialesInvalidas = () =>
    new AppError('Credenciales inválidas', 401);

  if (!usuario) throw credencialesInvalidas();

  const coincide = await bcrypt.compare(password, usuario.password_hash);
  if (!coincide) throw credencialesInvalidas();

  // Solo después de verificar la contraseña se informa el estado de la cuenta.
  if (!usuario.activo) {
    throw new AppError('Usuario inactivo: contacte al administrador', 403);
  }

  return {
    accessToken: generarToken(usuario),
    usuario: datosPublicos(usuario),
  };
}

module.exports = { registrar, iniciarSesion, generarToken, datosPublicos };
