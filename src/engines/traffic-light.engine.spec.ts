import { calcularSemaforo } from './traffic-light.engine';
import { calcularMetricas } from './metrics.engine';
import { GuaranteeRow, ObligationRow } from './types';
import { HOY, contratoSano, ctxDe, params } from './test-helpers';

function semaforoDe(overrides: Parameters<typeof contratoSano>[0], extra = {}) {
  const c = contratoSano(overrides);
  const ctx = ctxDe(c, extra);
  const m = calcularMetricas(c, ctx, HOY);
  return calcularSemaforo(c, ctx, m, HOY, params());
}

describe('Semaforo(c, m) · files/05 §2', () => {
  it('contrato sano → Normal sin razones', () => {
    const s = semaforoDe({});
    expect(s.nivel).toBe('normal');
    expect(s.razones).toHaveLength(0);
  });

  it('anulado → Sin información', () => {
    expect(semaforoDe({ anulado: true }).nivel).toBe('info');
  });

  it('sin fechas → Sin información', () => {
    expect(semaforoDe({ fechaInicio: null, fechaFin: null }).nivel).toBe('info');
  });

  it('sin valor → Sin información', () => {
    expect(semaforoDe({ valorBase: 0, iva: 0, otrosImp: 0 }).nivel).toBe('info');
  });

  it('liquidado → Normal', () => {
    expect(semaforoDe({ estado: 'Liquidado' }).nivel).toBe('normal');
  });

  it('plazo vencido y sigue activo → Crítico', () => {
    const s = semaforoDe({ fechaFin: '2026-09-01' });
    expect(s.nivel).toBe('critico');
    expect(s.razones[0]).toContain('venció');
  });

  it('vence en 5 días (≤ críticos) → Crítico', () => {
    const s = semaforoDe({ fechaFin: '2026-10-06' });
    expect(s.nivel).toBe('critico');
  });

  it('vence en 12 días → Riesgo; vence en 25 → Atención', () => {
    expect(semaforoDe({ fechaFin: '2026-10-13' }).nivel).toBe('riesgo');
    expect(semaforoDe({ fechaFin: '2026-10-26' }).nivel).toBe('atencion');
  });

  it('ejecución financiera > 100 % → Crítico', () => {
    const s = semaforoDe({}, {
      execs: [{ periodo: '2026-09', valor: 2_000_000 }],
    });
    expect(s.nivel).toBe('critico');
  });

  it('saldo < % saldo (15 %) → Riesgo con mensaje de recursos', () => {
    // valorActual 1 190 000; ejecutado 1 080 000 → saldo 9.2 % < 15 %
    const s = semaforoDe({}, {
      execs: [{ periodo: '2026-09', valor: 1_080_000 }],
    });
    expect(s.nivel).toBe('riesgo');
    expect(s.razones.some((r) => r.includes('agotar sus recursos'))).toBe(true);
  });

  it('brecha financiera vs física > 20 pp → Atención (solo activos)', () => {
    const s = semaforoDe({ avanceFisico: 5 }, {
      execs: [{ periodo: '2026-09', valor: 595_000 }],
    });
    expect(s.nivel).toBe('atencion');
  });

  it('3+ obligaciones vencidas/incumplidas → Crítico; 1–2 → Riesgo', () => {
    const vencidas: ObligationRow[] = [
      { id: 'OB-1', estado: 'Pendiente', fechaLimite: '2026-09-01' },
      { id: 'OB-2', estado: 'En proceso', fechaLimite: '2026-09-02' },
      { id: 'OB-3', estado: 'Pendiente', fechaLimite: '2026-09-03' },
    ];
    expect(semaforoDe({}, { obligations: vencidas }).nivel).toBe('critico');
    expect(semaforoDe({}, { obligations: [vencidas[0]] }).nivel).toBe('riesgo');
  });

  it('incumplimientos abiertos → Riesgo', () => {
    const s = semaforoDe({}, {
      breaches: [{ id: 'IN-1', estado: 'Abierto', impacto: 'Bajo' }],
    });
    expect(s.nivel).toBe('riesgo');
  });

  it('garantía aprobada vencida con contrato en curso → Crítico', () => {
    const gar: GuaranteeRow[] = [
      { id: 'GR-1', tipo: 'Cumplimiento', poliza: 'PL-1', aseguradora: 'SE', estado: 'Aprobada', valor: 100, fechaVenc: '2026-09-01' },
    ];
    const s = semaforoDe({}, { guarantees: gar });
    expect(s.nivel).toBe('critico');
    expect(s.razones.some((r) => r.includes('PL-1'))).toBe(true);
  });

  it('garantía aprobada vencida con contrato liquidado NO alerta', () => {
    const gar: GuaranteeRow[] = [
      { id: 'GR-1', tipo: 'Cumplimiento', poliza: 'PL-1', aseguradora: 'SE', estado: 'Aprobada', valor: 100, fechaVenc: '2026-09-01' },
    ];
    expect(semaforoDe({ estado: 'Liquidado' }, { guarantees: gar }).nivel).toBe('normal');
  });

  it('riesgos altos o extremos abiertos → Riesgo', () => {
    const s = semaforoDe({}, {
      risks: [{ id: 'RG-1', prob: 4, impacto: 4, estado: 'Abierto' }],
    });
    expect(s.nivel).toBe('riesgo');
  });

  it('entregables vencidos → Atención', () => {
    const s = semaforoDe({}, {
      deliverables: [{ id: 'EN-1', estado: 'Pendiente', fechaProg: '2026-09-01', fechaReal: null }],
    });
    expect(s.nivel).toBe('atencion');
  });

  it('documentos requeridos faltantes → Atención', () => {
    const s = semaforoDe({}, {
      documents: [{ id: 'DOC-1', categoria: 'Contrato' }],
    });
    expect(s.nivel).toBe('atencion');
    expect(s.razones.some((r) => r.includes('Faltan documentos requeridos'))).toBe(true);
  });

  it('suspendido → Atención', () => {
    expect(semaforoDe({ estado: 'Suspendido' }).nivel).toBe('atencion');
  });

  it('toma el PEOR nivel de todos los factores', () => {
    const s = semaforoDe({ estado: 'Suspendido', avanceFisico: 20 }, {
      execs: [{ periodo: '2026-09', valor: 1_200_000 }],
      obligations: [{ id: 'OB-1', estado: 'Incumplida' }],
    });
    expect(s.nivel).toBe('critico');
  });
});
