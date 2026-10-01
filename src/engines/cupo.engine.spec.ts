import { cupoStats } from './cupo.engine';

describe('cupoStats(cp) · utilización de cupos (files/06)', () => {
  const polizas = [
    { cupoId: 'CP-1', estado: 'Aprobada', valor: 500 },
    { cupoId: 'CP-1', estado: 'Pendiente', valor: 300 },
    { cupoId: 'CP-1', estado: 'Rechazada', valor: 200 },
    { cupoId: 'CP-1', estado: 'Anulada', valor: 100 },
    { cupoId: 'CP-1', estado: 'Aprobada', valor: 50, contractAnulado: true },
    { cupoId: 'CP-2', estado: 'Aprobada', valor: 999 },
  ];

  it('utilizado = Aprobadas o Pendientes del cupo, de pólizas y contratos no anulados', () => {
    const st = cupoStats({ id: 'CP-1', valor: 1_000 }, polizas);
    expect(st.utilizado).toBe(800);
    expect(st.disponible).toBe(200);
    expect(st.pctUso).toBe(80);
    expect(st.polizas).toBe(2);
  });

  it('disponible puede ser negativo si se aceptó una advertencia', () => {
    const st = cupoStats({ id: 'CP-1', valor: 700 }, [{ cupoId: 'CP-1', estado: 'Aprobada', valor: 800 }]);
    expect(st.disponible).toBe(-100);
    expect(st.pctUso).toBe(114.3);
  });

  it('cupo sin pólizas: 0 utilizado, 100 % disponible', () => {
    const st = cupoStats({ id: 'CP-3', valor: 1_000 }, polizas);
    expect(st.utilizado).toBe(0);
    expect(st.disponible).toBe(1_000);
    expect(st.pctUso).toBe(0);
    expect(st.polizas).toBe(0);
  });
});
