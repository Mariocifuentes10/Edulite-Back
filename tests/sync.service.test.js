/**
 * tests/sync.service.test.js
 * Unit tests de sync.service sin base de datos:
 *   • validarForma (Fase A, pura) con casos límite.
 *   • procesarLote con pool, progreso.service y evaluaciones.service mockeados:
 *     aceptación parcial, idCliente repetido, transacción por ítem y
 *     aislamiento de errores (AppError vs error inesperado).
 */
jest.mock('../config/db', () => ({
  pool: { connect: jest.fn() },
}));
jest.mock('../modulos/progreso/progreso.service', () => ({
  registrar: jest.fn(),
}));
jest.mock('../modulos/evaluaciones/evaluaciones.service', () => ({
  buscarPorId: jest.fn(),
  registrarRespuesta: jest.fn(),
}));

const { pool } = require('../config/db');
const progresoService = require('../modulos/progreso/progreso.service');
const evaluacionesService = require('../modulos/evaluaciones/evaluaciones.service');
const AppError = require('../utils/app-error');
const syncService = require('../modulos/sync/sync.service');

const UUID_A = '3f1a9c0e-6f4b-4a52-9d21-1c8e5b7a2d90';
const UUID_B = '8b6d2f14-9c3a-4e7b-b0d5-2a4f6e8c1a33';
const PASSADO = new Date(Date.now() - 60 * 1000).toISOString();

function itemProgreso(overrides = {}) {
  return {
    tipo: 'PROGRESO',
    idCliente: UUID_A,
    creadoEn: PASSADO,
    idLeccion: 1,
    completada: true,
    ...overrides,
  };
}

function itemRespuesta(overrides = {}) {
  return {
    tipo: 'RESPUESTA',
    idCliente: UUID_B,
    creadoEn: PASSADO,
    idEvaluacion: 1,
    respuesta: '19',
    ...overrides,
  };
}

describe('sync.service', () => {
  let cliente;

  beforeEach(() => {
    cliente = {
      query: jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 }),
      release: jest.fn(),
    };
    pool.connect.mockReset();
    pool.connect.mockResolvedValue(cliente);
    progresoService.registrar.mockReset();
    evaluacionesService.buscarPorId.mockReset();
    evaluacionesService.registrarRespuesta.mockReset();
  });

  describe('validarForma', () => {
    test('acepta un ítem PROGRESO bien formado', () => {
      expect(syncService.validarForma(itemProgreso())).toBeNull();
    });

    test('acepta un ítem RESPUESTA bien formado', () => {
      expect(syncService.validarForma(itemRespuesta())).toBeNull();
    });

    test('rechaza valores que no son objeto', () => {
      expect(syncService.validarForma(null)).toMatch(/objeto/i);
      expect(syncService.validarForma([])).toMatch(/objeto/i);
    });

    test('rechaza tipo desconocido', () => {
      expect(syncService.validarForma(itemProgreso({ tipo: 'OTRO' }))).toMatch(/tipo/i);
    });

    test('rechaza idCliente que no es UUID v4', () => {
      expect(syncService.validarForma(itemProgreso({ idCliente: 'abc' }))).toMatch(/UUID v4/i);
    });

    test('rechaza creadoEn ausente o inválida', () => {
      expect(syncService.validarForma(itemProgreso({ creadoEn: undefined }))).toMatch(/obligatoria/i);
      expect(syncService.validarForma(itemProgreso({ creadoEn: 'no-fecha' }))).toMatch(/ISO-8601/i);
    });

    test('rechaza creadoEn futura', () => {
      const futuro = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      expect(syncService.validarForma(itemProgreso({ creadoEn: futuro }))).toMatch(/futura/i);
    });

    test('valida payload de PROGRESO', () => {
      expect(syncService.validarForma(itemProgreso({ idLeccion: 0 }))).toMatch(/idLeccion/i);
      expect(syncService.validarForma(itemProgreso({ completada: 'sí' }))).toMatch(/completada/i);
    });

    test('valida payload de RESPUESTA', () => {
      expect(syncService.validarForma(itemRespuesta({ respuesta: '   ' }))).toMatch(/respuesta/i);
      expect(
        syncService.validarForma(itemRespuesta({ respuesta: 'x'.repeat(501) }))
      ).toMatch(/500/);
    });
  });

  describe('procesarLote', () => {
    test('lote vacío no toca la base', async () => {
      const resultado = await syncService.procesarLote([], 7);

      expect(resultado).toEqual({ aceptados: [], rechazados: [] });
      expect(pool.connect).not.toHaveBeenCalled();
    });

    test('ítem con forma inválida se rechaza sin abrir transacción', async () => {
      const resultado = await syncService.procesarLote([itemProgreso({ idLeccion: 0 })], 7);

      expect(resultado.aceptados).toEqual([]);
      expect(resultado.rechazados).toHaveLength(1);
      expect(resultado.rechazados[0].idCliente).toBe(UUID_A);
      expect(pool.connect).not.toHaveBeenCalled();
    });

    test('PROGRESO válido se acepta y se registra dentro de la transacción', async () => {
      progresoService.registrar.mockResolvedValueOnce({ id_usuario: 7, id_leccion: 1 });

      const resultado = await syncService.procesarLote([itemProgreso()], 7);

      expect(resultado.aceptados).toEqual([UUID_A]);
      expect(resultado.rechazados).toEqual([]);
      expect(progresoService.registrar).toHaveBeenCalledTimes(1);
      const args = progresoService.registrar.mock.calls[0][0];
      expect(args.idUsuario).toBe(7);
      expect(args.idLeccion).toBe(1);
      expect(typeof args.ejecutar).toBe('function');
      // BEGIN + registro + COMMIT
      expect(cliente.query).toHaveBeenCalledWith('BEGIN');
      expect(cliente.query).toHaveBeenCalledWith('COMMIT');
    });

    test('RESPUESTA válida valida inscripción y registra la respuesta', async () => {
      evaluacionesService.buscarPorId.mockResolvedValueOnce({
        id: 1,
        id_curso: 2,
        respuesta_correcta: '19',
      });
      evaluacionesService.registrarRespuesta.mockResolvedValueOnce({
        correcta: true,
        duplicado: false,
      });

      const resultado = await syncService.procesarLote([itemRespuesta()], 7);

      expect(resultado.aceptados).toEqual([UUID_B]);
      expect(evaluacionesService.registrarRespuesta).toHaveBeenCalledTimes(1);
    });

    test('RESPUESTA a evaluación inexistente se rechaza con motivo', async () => {
      evaluacionesService.buscarPorId.mockResolvedValueOnce(null);

      const resultado = await syncService.procesarLote([itemRespuesta()], 7);

      expect(resultado.aceptados).toEqual([]);
      expect(resultado.rechazados[0].motivo).toMatch(/no encontrada/i);
    });

    test('idCliente repetido en el lote: solo procesa el primero', async () => {
      progresoService.registrar.mockResolvedValue({ id_usuario: 7, id_leccion: 1 });

      const resultado = await syncService.procesarLote(
        [itemProgreso(), itemProgreso({ idLeccion: 2 })],
        7
      );

      expect(resultado.aceptados).toEqual([UUID_A]);
      expect(resultado.rechazados).toHaveLength(1);
      expect(resultado.rechazados[0].motivo).toMatch(/repetido/i);
      expect(progresoService.registrar).toHaveBeenCalledTimes(1);
    });

    test('aceptación parcial: un AppError no tumba el resto del lote', async () => {
      progresoService.registrar
        .mockRejectedValueOnce(new AppError('Lección no encontrada', 404))
        .mockResolvedValueOnce({ id_usuario: 7, id_leccion: 2 });

      const resultado = await syncService.procesarLote(
        [itemProgreso(), itemProgreso({ idCliente: UUID_B, idLeccion: 2 })],
        7
      );

      expect(resultado.rechazados).toEqual([
        { idCliente: UUID_A, motivo: 'Lección no encontrada' },
      ]);
      expect(resultado.aceptados).toEqual([UUID_B]);
      expect(cliente.query).toHaveBeenCalledWith('ROLLBACK');
    });

    test('error inesperado se aísla como rechazo genérico', async () => {
      const espia = jest.spyOn(console, 'error').mockImplementation(() => {});
      progresoService.registrar.mockRejectedValueOnce(new Error('boom'));

      const resultado = await syncService.procesarLote([itemProgreso()], 7);

      expect(resultado.rechazados[0].motivo).toMatch(/No se pudo procesar/i);
      espia.mockRestore();
    });
  });
});
