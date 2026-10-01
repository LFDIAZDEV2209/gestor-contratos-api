import { calcularMetricas, calcularControlScore, estadoEfectivo, estadoTemporal, valorActualDe } from './metrics.engine';
import { ContractCtx } from './types';
import { HOY, contratoSano, ctxDe } from './test-helpers';

describe('M(c) · métricas del contrato (files/05 §1)', () => {
  it('calcula valor inicial y valor actualizado', () => {
    const c = contratoSano({ valorBase: 100, iva: 19, otrosImp: 1, adiciones: 10, reducciones: 5 });
    const m = calcularMetricas(c, { execs: [], payments: [] }, HOY);
    expect(m.valorInicial).toBe(120);
    expect(m.valorActual).toBe(125);
  });

  it('ejecutado suma los registros de ejecución no anulados', () => {
    const execs = [
      { periodo: '2026-08', valor: 100 },
      { periodo: '2026-09', valor: 50 },
      { periodo: '2026-09', valor: 25, anulado: true },
    ];
    const m = calcularMetricas(contratoSano(), { execs, payments: [] }, HOY);
    expect(m.ejecutado).toBe(150);
  });

  it('pagado suma bruto + IVA de los pagos en estado Pagado', () => {
    const payments = [
      { estado: 'Pagado', bruto: 100, iva: 19 },
      { estado: 'Aprobado', bruto: 1000, iva: 190 },
      { estado: 'Pagado', bruto: 10, iva: 0, anulado: true },
    ];
    const m = calcularMetricas(contratoSano(), { execs: [], payments }, HOY);
    expect(m.pagado).toBe(119);
  });

  it('saldo y % ejecución financiera', () => {
    const c = contratoSano({ valorBase: 1000, iva: 0, adiciones: 100, reducciones: 0 });
    const m = calcularMetricas(c, { execs: [{ periodo: '2026-09', valor: 550 }], payments: [] }, HOY);
    expect(m.saldo).toBe(550);
    expect(m.pctFin).toBe(50);
  });

  it('duración: fin − inicio + 1; meses ÷ 30,4', () => {
    const c = contratoSano({ fechaInicio: '2026-05-10', fechaFin: '2026-05-20' });
    const m = calcularMetricas(c, { execs: [], payments: [] }, HOY);
    expect(m.duracionDias).toBe(11);
    expect(m.duracionMeses).toBe(0.4);
  });

  it('días transcurridos acotados a la duración y días restantes', () => {
    const c = contratoSano({ fechaInicio: '2026-05-10', fechaFin: '2026-05-20' });
    const m = calcularMetricas(c, { execs: [], payments: [] }, '2026-05-15');
    expect(m.diasTranscurridos).toBe(6);
    expect(m.restantes).toBe(5);
    expect(m.pctTiempo).toBe(54.5);
    const m2 = calcularMetricas(c, { execs: [], payments: [] }, '2027-01-01');
    expect(m2.diasTranscurridos).toBe(11);
    expect(m2.restantes).toBeLessThan(0);
  });

  it('estado efectivo: Activo con terminación pasada ⇒ Vencido; anulado ⇒ Anulado', () => {
    expect(estadoEfectivo(contratoSano({ fechaFin: '2026-09-01' }), HOY)).toBe('Vencido');
    expect(estadoEfectivo(contratoSano({ fechaFin: '2026-12-01' }), HOY)).toBe('Activo');
    expect(estadoEfectivo(contratoSano({ anulado: true }), HOY)).toBe('Anulado');
  });

  it('estado temporal según la ventana', () => {
    expect(estadoTemporal(contratoSano({ fechaInicio: '2026-12-01', fechaFin: '2027-01-01' }), HOY)).toBe('Por iniciar');
    expect(estadoTemporal(contratoSano({ fechaFin: '2026-09-01' }), HOY)).toBe('Plazo cumplido');
    expect(estadoTemporal(contratoSano({ fechaFin: '2026-10-15' }), HOY)).toBe('Próximo a vencer');
    expect(estadoTemporal(contratoSano({ fechaFin: '2026-12-15' }), HOY)).toBe('En plazo');
    expect(estadoTemporal(contratoSano({ fechaInicio: null, fechaFin: null }), HOY)).toBe('Sin fechas');
  });

  it('promedio mensual: últimos 3 periodos registrados', () => {
    const execs = [
      { periodo: '2026-01', valor: 100 },
      { periodo: '2026-02', valor: 200 },
      { periodo: '2026-03', valor: 300 },
      { periodo: '2026-04', valor: 400 },
    ];
    expect(calcularMetricas(contratoSano(), { execs, payments: [] }, HOY).promedioMensual).toBe(300);
    expect(calcularMetricas(contratoSano(), { execs: [], payments: [] }, HOY).promedioMensual).toBeNull();
  });

  it('fecha de agotamiento: hoy + (saldo ÷ promedio) × 30,4', () => {
    const execs = [
      { periodo: '2026-07', valor: 100 },
      { periodo: '2026-08', valor: 100 },
      { periodo: '2026-09', valor: 100 },
    ];
    const c = contratoSano({ valorBase: 3000, iva: 0 });
    const m = calcularMetricas(c, { execs, payments: [] }, HOY);
    // saldo 2700, promedio 100 → 2700 × 30,4 = 82 080 días después del 2026-10-01
    expect(m.fechaAgotamiento).toBe('2028-12-30');
    expect(m.seAgotaAntesDelPlazo).toBe(false);
  });

  it('saldo en cero o negativo ⇒ agotamiento hoy', () => {
    const execs = [{ periodo: '2026-09', valor: 2000 }];
    const c = contratoSano({ valorBase: 1000, iva: 0 });
    const m = calcularMetricas(c, { execs, payments: [] }, HOY);
    expect(m.fechaAgotamiento).toBe(HOY);
  });

  it('valorActualDe (helper de fórmula)', () => {
    expect(valorActualDe(100, 19, 1, 10, 5)).toBe(125);
  });

  it('índice de control: casos límite (files/05 §6)', () => {
    const c = contratoSano();
    const ctx = ctxDe(c, { auditCount: 3 });
    const m = calcularMetricas(c, ctx, HOY);
    const { score, nivel } = calcularControlScore(c, ctx, m, HOY);
    // Sin execs (30), sin garantías (0), sin pagos (60), sin riesgos (40), docs completos (100), obligaciones (50), auditoría (100)
    expect(score).toBe(Math.round(100 * 0.2 + 50 * 0.2 + 30 * 0.15 + 0 * 0.15 + 60 * 0.1 + 40 * 0.1 + 100 * 0.1));
    expect(nivel).toBe('rojo');
  });

  it('índice de control: rojo cuando el expediente está vacío', () => {
    const c = contratoSano();
    const ctx: ContractCtx = { ...ctxDe(c), documents: [], auditCount: 0 };
    const m = calcularMetricas(c, ctx, HOY);
    const { nivel } = calcularControlScore(c, ctx, m, HOY);
    expect(nivel).toBe('rojo');
  });
});
