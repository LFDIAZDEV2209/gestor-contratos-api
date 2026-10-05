import { paginar, leerPagina, partirEnMemoria } from './pagination';
import { diffDias, sumarDias, hoyISO, periodoAFecha, redondear1 } from './dates';
import { newId } from './ids';
import { entradasPorCampos } from './audit-diff';
import {
  ApiError,
  NoEncontrado,
  Conflicto,
  Validacion,
  WarningRequiresConfirmation,
  Prohibido,
} from './exceptions/api-exception';

describe('Common Helpers & Exceptions', () => {
  describe('pagination.ts', () => {
    it('paginar estructura la respuesta estándar', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const res = paginar(data, 10, 1, 2);

      expect(res).toEqual({
        data,
        total: 10,
        page: 1,
        pageSize: 2,
      });
    });

    it('leerPagina toma valores por defecto cuando query está vacío o inválido', () => {
      const { page, pageSize } = leerPagina({}, 25);
      expect(page).toBe(1);
      expect(pageSize).toBe(25);

      const invalidos = leerPagina({ page: -5, pageSize: 'abc' }, 50);
      expect(invalidos.page).toBe(1);
      expect(invalidos.pageSize).toBe(50);
    });

    it('leerPagina restringe pageSize a un máximo de 500 y mínimo de 1', () => {
      const exceso = leerPagina({ page: 2, pageSize: 1000 }, 25);
      expect(exceso.pageSize).toBe(500);
      expect(exceso.page).toBe(2);

      const minimo = leerPagina({ pageSize: 0 }, 25);
      expect(minimo.pageSize).toBe(25);
    });

    it('partirEnMemoria corta el arreglo en base a la página solicitada', () => {
      const items = ['a', 'b', 'c', 'd', 'e'];
      const pag1 = partirEnMemoria(items, 1, 2);
      expect(pag1.items).toEqual(['a', 'b']);
      expect(pag1.total).toBe(5);

      const pag2 = partirEnMemoria(items, 2, 2);
      expect(pag2.items).toEqual(['c', 'd']);

      const pag3 = partirEnMemoria(items, 3, 2);
      expect(pag3.items).toEqual(['e']);
    });
  });

  describe('dates.ts', () => {
    it('diffDias calcula la diferencia exacta en días entre dos fechas ISO', () => {
      expect(diffDias('2026-01-01', '2026-01-10')).toBe(9);
      expect(diffDias('2026-01-10', '2026-01-01')).toBe(-9);
      expect(diffDias('2026-01-01', '2026-01-01')).toBe(0);
    });

    it('sumarDias añade N días a una fecha ISO', () => {
      expect(sumarDias('2026-01-01', 10)).toBe('2026-01-11');
      expect(sumarDias('2026-01-31', 1)).toBe('2026-02-01');
    });

    it('hoyISO devuelve una fecha en formato YYYY-MM-DD', () => {
      expect(hoyISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('periodoAFecha convierte YYYY-MM en primer día del mes YYYY-MM-01', () => {
      expect(periodoAFecha('2026-05')).toBe('2026-05-01');
    });

    it('redondear1 redondea a un decimal', () => {
      expect(redondear1(12.345)).toBe(12.3);
      expect(redondear1(12.385)).toBe(12.4);
    });
  });

  describe('ids.ts', () => {
    it('newId genera identificadores con prefijo y caracteres alfanuméricos', () => {
      const idCt = newId('CT');
      expect(idCt).toMatch(/^CT-[A-Z0-9]+$/);

      const idGr = newId('GR');
      expect(idGr).toMatch(/^GR-[A-Z0-9]+$/);
    });
  });

  describe('audit-diff.ts', () => {
    it('entradasPorCampos genera diffs de campos modificados', () => {
      const prev = { valor: 100, nombre: 'Viejo', tipo: 'Obra' };
      const next = { valor: 200, nombre: 'Viejo', tipo: 'Servicios' };
      const campos = ['valor', 'nombre', 'tipo'];

      const entradas = entradasPorCampos(prev, next, campos, {
        contractId: 'CT-01',
        modulo: 'Contratos',
        accion: 'EDITAR',
      });

      expect(entradas).toHaveLength(2); // solo valor y tipo cambiaron
      expect(entradas).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ campo: 'valor', anterior: '100', nuevo: '200' }),
          expect.objectContaining({ campo: 'tipo', anterior: 'Obra', nuevo: 'Servicios' }),
        ]),
      );
    });
  });

  describe('api-exception.ts', () => {
    it('NoEncontrado tiene status 404 y código NOT_FOUND', () => {
      const e = new NoEncontrado('El contrato CT-01');
      expect(e.getStatus()).toBe(404);
      expect(e.code).toBe('NOT_FOUND');
      expect(e.message).toBe('El contrato CT-01 no existe.');
    });

    it('Conflicto tiene status 409 y código CONFLICT', () => {
      const e = new Conflicto('Registro en conflicto', ['numero']);
      expect(e.getStatus()).toBe(409);
      expect(e.code).toBe('CONFLICT');
      expect(e.fields).toEqual(['numero']);
    });

    it('Validacion tiene status 400 y código VALIDATION_ERROR', () => {
      const e = new Validacion('Datos inválidos', ['valorBase']);
      expect(e.getStatus()).toBe(400);
      expect(e.code).toBe('VALIDATION_ERROR');
    });

    it('WarningRequiresConfirmation tiene status 422 y advertencias', () => {
      const e = new WarningRequiresConfirmation('Inconsistencia aceptable', ['Vence antes de inicio']);
      expect(e.getStatus()).toBe(422);
      expect(e.code).toBe('WARNING_REQUIRES_CONFIRMATION');
      expect(e.warnings).toEqual(['Vence antes de inicio']);
    });

    it('Prohibido tiene status 403 y ApiError 401 tiene UNAUTHENTICATED', () => {
      const p = new Prohibido('Sin permisos');
      expect(p.getStatus()).toBe(403);
      expect(p.code).toBe('FORBIDDEN');

      const a = new ApiError(401, 'UNAUTHENTICATED', 'Sin token');
      expect(a.getStatus()).toBe(401);
      expect(a.code).toBe('UNAUTHENTICATED');
    });
  });
});
