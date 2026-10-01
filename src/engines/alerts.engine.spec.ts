import { calcularAlertas, calcularAlertasCupos, nivelPorDias } from './alerts.engine';
import { calcularMetricas } from './metrics.engine';
import { cupoStats } from './cupo.engine';
import { HOY, contratoSano, ctxDe, params } from './test-helpers';

function alertasDe(overrides = {}, extra = {}) {
  const c = contratoSano(overrides);
  const ctx = ctxDe(c, extra);
  return calcularAlertas(ctx, calcularMetricas(c, ctx, HOY), params(), HOY);
}

describe('Alertas · claves estables y 16 tipos (files/05 §3, files/06)', () => {
  it('contrato activo que vence en 5 días: alertas por cada umbral cruzado (5,3,1)', () => {
    const a = alertasDe({ fechaFin: '2026-10-06' });
    const claves = a.map((x) => x.key);
    expect(claves).toContain('contrato|CT-99|30');
    expect(claves).toContain('contrato|CT-99|15');
    expect(claves).toContain('contrato|CT-99|10');
    expect(claves).toContain('contrato|CT-99|5');
    expect(claves).not.toContain('contrato|CT-99|3'); // 5 días restantes no cruza el umbral de 3
    expect(claves).not.toContain('contrato|CT-99|60');
    // Nivel por días reales: 5 ≤ críticos ⇒ crítica
    expect(a.every((x) => x.nivel === 'critica')).toBe(true);
  });

  it('contrato que vence en 25 días: nivel próxima (una sola entrada por umbral 30)', () => {
    const a = alertasDe({ fechaFin: '2026-10-26' });
    expect(a.map((x) => x.key)).toEqual(['contrato|CT-99|30']);
    expect(a[0].nivel).toBe('proxima');
  });

  it('contrato vencido ⇒ alerta crítica con clave estable distinta', () => {
    const a = alertasDe({ fechaFin: '2026-09-01' });
    expect(a.map((x) => x.key)).toContain('contrato|CT-99|v');
    expect(a.find((x) => x.key.endsWith('|v'))?.nivel).toBe('critica');
  });

  it('nivelPorDias: crítica ≤5, riesgo ≤15, próxima en los demás casos', () => {
    expect(nivelPorDias(5, 5)).toBe('critica');
    expect(nivelPorDias(6, 5)).toBe('riesgo');
    expect(nivelPorDias(16, 5)).toBe('proxima');
  });

  it('garantía aprobada vencida con contrato en curso ⇒ crítica gar|id|v', () => {
    const a = alertasDe({}, {
      guarantees: [{ id: 'GR-07', tipo: 'Cumplimiento', poliza: 'PL-7', estado: 'Aprobada', valor: 100, fechaVenc: '2026-09-25' }],
    });
    const gar = a.find((x) => x.key === 'gar|GR-07|v');
    expect(gar).toBeDefined();
    expect(gar?.nivel).toBe('critica');
  });

  it('garantía por vencer cruza umbral: una alerta por umbral (ej. 15)', () => {
    const a = alertasDe({}, {
      guarantees: [{ id: 'GR-07', tipo: 'Cumplimiento', poliza: 'PL-7', estado: 'Aprobada', valor: 100, fechaVenc: '2026-10-16' }],
    });
    expect(a.map((x) => x.key)).toContain('gar|GR-07|15');
    expect(a.map((x) => x.key)).not.toContain('gar|GR-07|10');
    expect(a.find((x) => x.key === 'gar|GR-07|15')?.nivel).toBe('riesgo');
  });

  it('garantía pendiente (no aprobada) no genera alertas de garantía', () => {
    const a = alertasDe({}, {
      guarantees: [{ id: 'GR-08', tipo: 'Estabilidad', poliza: 'PL-8', estado: 'Pendiente', valor: 100, fechaVenc: '2026-10-02' }],
    });
    expect(a.filter((x) => x.key.startsWith('gar|'))).toHaveLength(0);
  });

  it('garantía vencida con contrato terminado (cerrado) no genera alertas', () => {
    const a = alertasDe({ estado: 'Terminado' }, {
      guarantees: [{ id: 'GR-09', tipo: 'Cumplimiento', poliza: 'PL-9', estado: 'Aprobada', valor: 100, fechaVenc: '2026-09-01' }],
    });
    expect(a.filter((x) => x.key.startsWith('gar|'))).toHaveLength(0);
  });

  it('obligación vencida ⇒ riesgo; incumplida ⇒ crítica', () => {
    const a = alertasDe({}, {
      obligations: [
        { id: 'OB-1', estado: 'Pendiente', fechaLimite: '2026-09-01' },
        { id: 'OB-2', estado: 'Incumplida', fechaLimite: '2026-12-01' },
      ],
    });
    expect(a.map((x) => x.key)).toContain('obl|OB-1|v');
    expect(a.find((x) => x.key === 'obl|OB-1|v')?.nivel).toBe('riesgo');
    expect(a.map((x) => x.key)).toContain('obl|OB-2|i');
    expect(a.find((x) => x.key === 'obl|OB-2|i')?.nivel).toBe('critica');
  });

  it('entregable vencido ⇒ riesgo ent|id|v', () => {
    const a = alertasDe({}, {
      deliverables: [{ id: 'EN-12', estado: 'Pendiente', fechaProg: '2026-09-01', fechaReal: null }],
    });
    expect(a.map((x) => x.key)).toContain('ent|EN-12|v');
  });

  it('pago pendiente y en revisión ⇒ informativa pag|id|p', () => {
    const a = alertasDe({}, {
      payments: [
        { id: 'PG-1', estado: 'Pendiente', bruto: 10 },
        { id: 'PG-2', estado: 'En revisión', bruto: 10 },
        { id: 'PG-3', estado: 'Pagado', bruto: 10 },
      ],
    });
    expect(a.map((x) => x.key).sort()).toEqual(['pag|PG-1|p', 'pag|PG-2|p']);
  });

  it('ejecución > 100 % ⇒ crítica ejec|id|o; presupuesto < 15 % ⇒ riesgo ejec|id|s', () => {
    const a = alertasDe({}, {
      execs: [{ periodo: '2026-09', valor: 2_000_000 }],
    });
    expect(a.map((x) => x.key)).toContain('ejec|CT-99|o');
    // saldo: valorActual 1 190 000, ejecutado 2 000 000 ⇒ pctSaldo negativo < 15 %
    expect(a.map((x) => x.key)).toContain('ejec|CT-99|s');
  });

  it('incumplimiento abierto: crítica si impacto Alto, riesgo si no', () => {
    const a = alertasDe({}, {
      breaches: [
        { id: 'IN-1', estado: 'Abierto', impacto: 'Alto' },
        { id: 'IN-2', estado: 'En gestión', impacto: 'Medio' },
        { id: 'IN-3', estado: 'Subsanado', impacto: 'Alto' },
      ],
    });
    const in1 = a.find((x) => x.key === 'inc|IN-1|v');
    const in2 = a.find((x) => x.key === 'inc|IN-2|v');
    expect(in1?.nivel).toBe('critica');
    expect(in2?.nivel).toBe('riesgo');
    expect(a.filter((x) => x.key.startsWith('inc|IN-3'))).toHaveLength(0);
  });

  it('documento faltante ⇒ informativa doc|contrato|categoría', () => {
    const a = alertasDe({}, {
      documents: [{ id: 'DOC-1', categoria: 'Contrato' }],
    });
    expect(a.map((x) => x.key).sort()).toEqual(['doc|CT-99|Actas', 'doc|CT-99|Garantías', 'doc|CT-99|Propuesta']);
  });

  it('anulado no genera alertas', () => {
    expect(alertasDe({ anulado: true })).toHaveLength(0);
  });

  it('alertas de cupos: excedido (crítica), ≥85 % (riesgo), vencido y por vencer', () => {
    const stats = cupoStats(
      { id: 'CP-1', valor: 100 },
      [
        { cupoId: 'CP-1', estado: 'Aprobada', valor: 110 },
        { cupoId: 'CP-1', estado: 'Rechazada', valor: 50 },
      ],
    );
    const alertas = calcularAlertasCupos(
      [{ id: 'CP-1', aseguradora: 'SE', numero: 'CU-1', valor: 100, estado: 'Vigente', fechaVenc: '2026-10-16', stats }],
      params(),
      HOY,
    );
    expect(alertas.map((a) => a.key)).toContain('cupo|CP-1|o');
    expect(alertas.map((a) => a.key)).toContain('cupo|CP-1|15');
    expect(alertas.find((a) => a.key === 'cupo|CP-1|o')?.nivel).toBe('critica');
  });

  it('cupo vencido marcado Vigente ⇒ crítica; cupo anulado no alerta', () => {
    const stats = cupoStats({ id: 'CP-2', valor: 100 }, []);
    const alertas = calcularAlertasCupos(
      [
        { id: 'CP-2', aseguradora: 'SE', numero: 'CU-2', valor: 100, estado: 'Vigente', fechaVenc: '2026-09-01', stats },
        { id: 'CP-3', aseguradora: 'SE', numero: 'CU-3', valor: 100, estado: 'Anulado', fechaVenc: '2026-09-01', stats },
      ],
      params(),
      HOY,
    );
    expect(alertas.map((a) => a.key)).toContain('cupo|CP-2|v');
    expect(alertas.filter((a) => a.key.startsWith('cupo|CP-3'))).toHaveLength(0);
  });
});
