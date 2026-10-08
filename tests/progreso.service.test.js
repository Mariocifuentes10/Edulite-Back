/**
 * tests/progreso.service.test.js
 * Unit tests de progreso.service con la base de datos mockeada.
 * Verifica reglas de negocio: 404 lección inexistente, 403 no inscrito,
 * idempotencia (ON CONFLICT) y que el porcentaje se calcula en SQL.
 */
jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

const { query } = require('../config/db');
const progresoService = require('../modulos/progreso/progreso.service');

async function esperarError(promesa) {
  try {
    await promesa;
  } catch (error) {
    return error;
  }
  throw new Error('Se esperaba que la promesa rechazara, pero se resolvió');
}

describe('progreso.service', () => {
  beforeEach(() => {
    query.mockReset();
  });

  describe('registrar', () => {
    const base = { idUsuario: 7, idLeccion: 1, completada: true };

    test('404 si la lección no existe', async () => {
      query.mockResolvedValueOnce({ rows: [] }); // SELECT lección

      const error = await esperarError(progresoService.registrar(base));

      expect(error.statusCode).toBe(404);
      expect(error.message).toMatch(/lección/i);
      expect(query).toHaveBeenCalledTimes(1);
    });

    test('403 si el estudiante no está inscrito en el curso de la lección', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // lección existe
        .mockResolvedValueOnce({ rows: [] }); // no inscrito

      const error = await esperarError(progresoService.registrar(base));

      expect(error.statusCode).toBe(403);
      expect(error.message).toMatch(/inscrito/i);
    });

    test('éxito: inserta con ON CONFLICT y devuelve la fila', async () => {
      const fila = {
        id_usuario: 7,
        id_leccion: 1,
        completada: true,
        actualizado_en: new Date('2026-01-01T00:00:00Z'),
      };
      query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // lección
        .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }) // inscrito
        .mockResolvedValueOnce({ rows: [fila] }); // INSERT

      const resultado = await progresoService.registrar(base);

      expect(resultado).toEqual(fila);
      const sqlInsert = query.mock.calls[2][0];
      expect(sqlInsert).toContain('ON CONFLICT (id_usuario, id_leccion)');
      expect(sqlInsert).toContain('DO UPDATE');
      expect(query.mock.calls[2][1]).toEqual([7, 1, true, null]);
    });

    test('propaga actualizadoEn del cliente (sync) y el ejecutar transaccional', async () => {
      const ejecutar = jest.fn();
      const fecha = new Date('2026-01-02T00:00:00Z');
      ejecutar
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
        .mockResolvedValueOnce({ rows: [{ id_usuario: 7, id_leccion: 1, completada: false, actualizado_en: fecha }] });

      await progresoService.registrar({
        ...base,
        completada: false,
        actualizadoEn: fecha,
        ejecutar,
      });

      expect(ejecutar).toHaveBeenCalledTimes(3);
      expect(ejecutar.mock.calls[2][1]).toEqual([7, 1, false, fecha]);
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('obtenerAvance', () => {
    test('devuelve la fila agregada y calcula el porcentaje en SQL', async () => {
      const fila = { completadas: 3, totales: 4, porcentaje: 75 };
      query.mockResolvedValueOnce({ rows: [fila] });

      const resultado = await progresoService.obtenerAvance(7, 2);

      expect(resultado).toEqual(fila);
      const sql = query.mock.calls[0][0];
      expect(sql).toContain('FILTER (WHERE p.completada)');
      expect(sql).toContain('LEFT JOIN progreso');
      expect(query.mock.calls[0][1]).toEqual([7, 2]);
    });
  });

  describe('obtenerAvanceGlobal', () => {
    test('usa la misma fórmula sobre los cursos inscritos', async () => {
      const fila = { completadas: 5, totales: 8, porcentaje: 63 };
      query.mockResolvedValueOnce({ rows: [fila] });

      const resultado = await progresoService.obtenerAvanceGlobal(7);

      expect(resultado).toEqual(fila);
      const sql = query.mock.calls[0][0];
      expect(sql).toContain('FROM inscripciones i');
      expect(sql).toContain('FILTER (WHERE p.completada)');
    });
  });

  describe('obtenerProgresoCurso', () => {
    test('404 si el curso no existe', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const error = await esperarError(progresoService.obtenerProgresoCurso(7, 99));

      expect(error.statusCode).toBe(404);
    });

    test('403 si no está inscrito', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ id: 2, titulo: 'Curso' }] })
        .mockResolvedValueOnce({ rows: [] });

      const error = await esperarError(progresoService.obtenerProgresoCurso(7, 2));

      expect(error.statusCode).toBe(403);
    });

    test('éxito: compone curso, avance y lecciones', async () => {
      query.mockImplementation((sql) => {
        if (sql.includes('FROM cursos WHERE id')) {
          return Promise.resolve({ rows: [{ id: 2, titulo: 'Curso' }] });
        }
        if (sql.includes('FROM inscripciones WHERE id_curso')) {
          return Promise.resolve({ rows: [{ '?column?': 1 }] });
        }
        if (sql.includes('FILTER (WHERE p.completada)')) {
          return Promise.resolve({ rows: [{ completadas: 1, totales: 2, porcentaje: 50 }] });
        }
        return Promise.resolve({
          rows: [{ id: 1, orden: 1, titulo: 'L1', completada: true }],
        });
      });

      const resultado = await progresoService.obtenerProgresoCurso(7, 2);

      expect(resultado.curso).toEqual({ id: 2, titulo: 'Curso' });
      expect(resultado.porcentaje).toBe(50);
      expect(resultado.lecciones).toHaveLength(1);
    });
  });
});
