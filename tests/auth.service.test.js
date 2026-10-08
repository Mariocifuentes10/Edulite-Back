/**
 * tests/auth.service.test.js
 * Tests unitarios de auth.service con la capa de base de datos mockeada.
 * Cubre el Definition of Done del Sprint 1:
 *   1. Registro exitoso
 *   2. Email duplicado -> 409
 *   3. Login inválido -> 401
 * Extra: registro con rol ADMIN -> 400 y ausencia de password_hash en respuestas.
 */

// Mock de la capa de datos: los tests NO requieren PostgreSQL corriendo.
jest.mock('../config/db', () => ({
  query: jest.fn(),
  pool: {},
  cerrar: jest.fn(),
}));

const { query } = require('../config/db');
const authService = require('../modulos/auth/auth.service');
const AppError = require('../utils/app-error');

const USUARIO_FILA_SEGURA = {
  id: 1,
  nombre: 'María Pérez',
  email: 'maria@ejemplo.com',
  rol: 'ESTUDIANTE',
  telefono: null,
  activo: true,
  creado_en: new Date('2026-01-01T00:00:00Z'),
};

const USUARIO_FILA_LOGIN = {
  id: 1,
  nombre: 'María Pérez',
  email: 'maria@ejemplo.com',
  rol: 'ESTUDIANTE',
  activo: true,
  password_hash: '$2b$10$abcdefghijklmnopqrstuv', // bcrypt fake para el mock
};

const DATOS_REGISTRO = {
  nombre: 'María Pérez',
  email: 'maria@ejemplo.com',
  password: 'Segura123',
  rol: 'ESTUDIANTE',
  telefono: null,
};

async function esperarError(promesa) {
  try {
    await promesa;
  } catch (error) {
    return error;
  }
  throw new Error('Se esperaba que la promesa rechazara, pero se resolvió');
}

describe('auth.service', () => {
  beforeEach(() => {
    query.mockReset();
  });

  describe('registrar', () => {
    test('registro exitoso devuelve accessToken y usuario sin password_hash', async () => {
      query.mockResolvedValue({ rows: [USUARIO_FILA_SEGURA] });

      const resultado = await authService.registrar(DATOS_REGISTRO);

      expect(resultado.accessToken).toEqual(expect.any(String));
      expect(resultado.usuario).toEqual({
        id: 1,
        nombre: 'María Pérez',
        email: 'maria@ejemplo.com',
        rol: 'ESTUDIANTE',
      });
      expect(resultado.usuario).not.toHaveProperty('password_hash');
      expect(JSON.stringify(resultado)).not.toContain('password_hash');

      // Verifica que se hasheó con bcrypt (cost >= 10) y que nunca viaja en claro.
      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('INSERT INTO usuarios');
      expect(params[2]).toMatch(/^\$2[aby]\$1\d\$/);
      expect(params).not.toContain('Segura123');
    });

    test('email duplicado rechaza con AppError 409', async () => {
      const errorPg = new Error('duplicate key value violates unique constraint');
      errorPg.code = '23505';
      query.mockRejectedValue(errorPg);

      const error = await esperarError(authService.registrar(DATOS_REGISTRO));

      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(409);
      expect(error.message).toBe('El email ya está registrado');
    });

    test('registro público con rol ADMIN se rechaza con 400', async () => {
      const error = await esperarError(
        authService.registrar({ ...DATOS_REGISTRO, rol: 'ADMIN' })
      );

      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(400);
      expect(query).not.toHaveBeenCalled(); // nunca llega a la base de datos
    });
  });

  describe('iniciarSesion', () => {
    test('login inválido (contraseña incorrecta) rechaza con 401', async () => {
      // bcrypt.compare(password, hash) devolverá false con cualquier hash malformado
      // o distinto; usamos una fila con hash real pero contraseña distinta.
      const bcrypt = require('bcrypt');
      const hashReal = bcrypt.hashSync('OtraClave123', 10);
      query.mockResolvedValue({
        rows: [{ ...USUARIO_FILA_LOGIN, password_hash: hashReal }],
      });

      const error = await esperarError(
        authService.iniciarSesion('maria@ejemplo.com', 'ClaveErronea1')
      );

      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Credenciales inválidas');
    });

    test('login con email inexistente responde el mismo 401 (anti-enumeración)', async () => {
      query.mockResolvedValue({ rows: [] });

      const error = await esperarError(
        authService.iniciarSesion('noexiste@ejemplo.com', 'Cualquiera123')
      );

      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Credenciales inválidas');
    });

    test('login válido devuelve accessToken y usuario público', async () => {
      const bcrypt = require('bcrypt');
      const hashReal = bcrypt.hashSync('Segura123', 10);
      query.mockResolvedValue({
        rows: [{ ...USUARIO_FILA_LOGIN, password_hash: hashReal }],
      });

      const resultado = await authService.iniciarSesion(
        'maria@ejemplo.com',
        'Segura123'
      );

      expect(resultado.accessToken).toEqual(expect.any(String));
      expect(resultado.usuario).toEqual({
        id: 1,
        nombre: 'María Pérez',
        email: 'maria@ejemplo.com',
        rol: 'ESTUDIANTE',
      });
      expect(resultado.usuario).not.toHaveProperty('password_hash');
    });

    test('usuario inactivo con contraseña correcta rechaza con 403', async () => {
      const bcrypt = require('bcrypt');
      const hashReal = bcrypt.hashSync('Segura123', 10);
      query.mockResolvedValue({
        rows: [
          { ...USUARIO_FILA_LOGIN, password_hash: hashReal, activo: false },
        ],
      });

      const error = await esperarError(
        authService.iniciarSesion('maria@ejemplo.com', 'Segura123')
      );

      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(403);
      expect(error.message).toContain('inactivo');
    });
  });
});
