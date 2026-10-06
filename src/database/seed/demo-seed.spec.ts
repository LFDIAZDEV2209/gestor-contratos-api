import { EntityManager } from 'typeorm';
import { sembrarDatosDemo } from './demo-seed';
import { ExecEntity } from '../../modules/contracts/entities/execs.entity';

describe('sembrarDatosDemo', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('genera periodos consecutivos sin duplicados al comenzar a fin de mes', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-06T12:00:00Z'));
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const ejecuciones: { contractId: string; periodo: string }[] = [];
    const manager = {
      getRepository: (entidad: unknown) => ({
        count: async () => 0,
        create: (valor: unknown) => valor,
        insert: async (valor: { contractId: string; periodo: string }) => {
          if (entidad === ExecEntity) ejecuciones.push(valor);
        },
      }),
      query: async () => [{ c: 0 }],
    } as unknown as EntityManager;
    await sembrarDatosDemo(manager);
    const periodos = ejecuciones.filter((fila) => fila.contractId === 'CT-03').map((fila) => fila.periodo);
    expect(periodos).toEqual(['2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04']);
    expect(new Set(ejecuciones.map((fila) => `${fila.contractId}|${fila.periodo}`)).size).toBe(ejecuciones.length);
  });

  it('conserva los datos cuando ya existen usuarios', async () => {
    const insert = jest.fn();
    const query = jest.fn();
    const manager = { getRepository: () => ({ count: async () => 8, insert }), query } as unknown as EntityManager;
    await sembrarDatosDemo(manager);
    expect(insert).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });
});
