import { validarContratoCompleto, validarBorrador, bloqueaGuardado } from './validator.engine';
import { calcularMetricas } from './metrics.engine';
import { HOY, contratoSano, ctxDe, params } from './test-helpers';

describe('Validador integral · 13 áreas (files/05 §4)', () => {
  it('contrato sano: 0 inconsistencias', () => {
    const c = contratoSano();
    const ctx = ctxDe(c, {
      guarantees: [{ id: 'GR-1', tipo: 'Cumplimiento', poliza: 'PL-1', aseguradora: 'SE', estado: 'Aprobada', valor: 1_000_000, porcentaje: 10, fechaVenc: '2027-01-01' }],
      execs: [{ periodo: '2026-09', valor: 500_000 }],
      obligations: [{ id: 'OB-1', estado: 'Cumplida', fechaLimite: '2026-09-01' }],
    });
    const m = calcularMetricas(c, ctx, HOY);
    const r = validarContratoCompleto(ctx, m, HOY, params());
    expect(r.resumen.total).toBe(0);
    expect(r.resumen.mensaje).toBe('Contrato validado correctamente');
  });

  it('fechas: terminación anterior al inicio (Alta) e inicio anterior a la firma (Media)', () => {
    const c = contratoSano({ fechaInicio: '2026-06-01', fechaFin: '2026-05-01', fechaFirma: '2026-06-15' });
    const ctx = ctxDe(c);
    const m = calcularMetricas(c, ctx, HOY);
    const r = validarContratoCompleto(ctx, m, HOY, params());
    expect(r.issues.some((i) => i.area === 'Fechas' && i.severidad === 'Alta' && i.campo === 'fechaFin')).toBe(true);
    expect(r.issues.some((i) => i.area === 'Fechas' && i.severidad === 'Media' && i.campo === 'fechaInicio')).toBe(true);
  });

  it('fechas: activo con plazo vencido (Alta)', () => {
    const c = contratoSano({ fechaFin: '2026-09-01' });
    const ctx = ctxDe(c);
    const m = calcularMetricas(c, ctx, HOY);
    const r = validarContratoCompleto(ctx, m, HOY, params());
    expect(r.issues.some((i) => i.area === 'Fechas' && i.severidad === 'Alta' && i.mensaje.includes('plazo ya venció'))).toBe(true);
  });

  it('modificaciones: la terminación no coincide con la última prórroga', () => {
    const c = contratoSano();
    const ctx = ctxDe(c, {
      modifications: [{ id: 'MD-1', tipo: 'Prórroga', fechaNueva: '2027-01-15' }],
    });
    const m = calcularMetricas(c, ctx, HOY);
    const r = validarContratoCompleto(ctx, m, HOY, params());
    expect(r.issues.some((i) => i.area === 'Modificaciones' && i.campo === 'fechaFin')).toBe(true);
  });

  it('valores: adiciones ≠ modificaciones (Media); ejecutado > valor actual (Alta)', () => {
    const c = contratoSano({ adiciones: 100_000 });
    const ctx = ctxDe(c, {
      modifications: [{ id: 'MD-1', tipo: 'Adición', valorAnterior: 1_190_000, valorNuevo: 1_290_000 }],
      execs: [{ periodo: '2026-09', valor: 2_000_000 }],
    });
    const m = calcularMetricas(c, ctx, HOY);
    const r = validarContratoCompleto(ctx, m, HOY, params());
    expect(r.issues.some((i) => i.area === 'Valores' && i.severidad === 'Media' && i.campo === 'adiciones')).toBe(false);
    expect(r.issues.some((i) => i.area === 'Valores' && i.severidad === 'Alta' && i.campo === 'ejecutado')).toBe(true);
  });

  it('pagos: pagado > valor actualizado (Alta) y pagado sin soporte (Baja)', () => {
    const c = contratoSano();
    const ctx = ctxDe(c, {
      execs: [],
      payments: [
        { id: 'PG-1', estado: 'Pagado', bruto: 2_000_000, iva: 0, soporte: null },
      ],
    });
    const m = calcularMetricas(c, ctx, HOY);
    const r = validarContratoCompleto(ctx, m, HOY, params());
    expect(r.issues.some((i) => i.area === 'Pagos' && i.severidad === 'Alta' && i.campo === 'pagado')).toBe(true);
    expect(r.issues.some((i) => i.area === 'Pagos' && i.severidad === 'Baja' && i.campo === 'soporte')).toBe(true);
  });

  it('garantías: contrato sin garantías (Alta) y póliza aprobada vencida (Alta)', () => {
    const c = contratoSano();
    const ctx1 = ctxDe(c, { guarantees: [] });
    const m1 = calcularMetricas(c, ctx1, HOY);
    expect(validarContratoCompleto(ctx1, m1, HOY, params()).issues.some((i) => i.area === 'Garantías' && i.severidad === 'Alta')).toBe(true);

    const ctx2 = ctxDe(c, {
      guarantees: [{ id: 'GR-1', tipo: 'Cumplimiento', poliza: 'PL-1', aseguradora: 'SE', estado: 'Aprobada', valor: 100, fechaVenc: '2026-09-01' }],
    });
    const m2 = calcularMetricas(c, ctx2, HOY);
    expect(validarContratoCompleto(ctx2, m2, HOY, params()).issues.some((i) => i.area === 'Garantías' && i.severidad === 'Alta' && i.campo === 'fechaVenc')).toBe(true);
  });

  it('garantías: cumplimiento que no cubre el plazo y valor menor al porcentaje pactado', () => {
    const c = contratoSano();
    const ctx = ctxDe(c, {
      guarantees: [{
        id: 'GR-1', tipo: 'Cumplimiento', poliza: 'PL-1', aseguradora: 'SE', estado: 'Aprobada',
        valor: 50_000, porcentaje: 50, fechaVenc: '2026-11-01',
      }],
    });
    const m = calcularMetricas(c, ctx, HOY);
    const r = validarContratoCompleto(ctx, m, HOY, params());
    expect(r.issues.some((i) => i.area === 'Garantías' && i.severidad === 'Media' && i.mensaje.includes('no cubre el plazo'))).toBe(true);
    expect(r.issues.some((i) => i.area === 'Garantías' && i.severidad === 'Media' && i.campo === 'valor')).toBe(true);
  });

  it('obligaciones: 3 vencidas → Alta; sin obligaciones → Baja', () => {
    const c = contratoSano();
    const vencidas = [
      { id: 'OB-1', estado: 'Pendiente', fechaLimite: '2026-09-01' },
      { id: 'OB-2', estado: 'Pendiente', fechaLimite: '2026-09-02' },
      { id: 'OB-3', estado: 'Incumplida' },
    ];
    const ctx = ctxDe(c, { obligations: vencidas });
    const m = calcularMetricas(c, ctx, HOY);
    const r = validarContratoCompleto(ctx, m, HOY, params());
    expect(r.issues.some((i) => i.area === 'Obligaciones' && i.severidad === 'Alta')).toBe(true);

    const ctxVacio = ctxDe(c, { obligations: [] });
    const m2 = calcularMetricas(c, ctxVacio, HOY);
    expect(validarContratoCompleto(ctxVacio, m2, HOY, params()).issues.some((i) => i.area === 'Obligaciones' && i.severidad === 'Baja')).toBe(true);
  });

  it('subcontratos: suma mayor al valor (Alta) y fin posterior al principal (Media)', () => {
    const c = contratoSano();
    const ctx = ctxDe(c, {
      subcontracts: [
        { id: 'SC-1', valor: 700_000, fechaFin: '2027-01-31' },
        { id: 'SC-2', valor: 600_000, fechaFin: '2026-12-01' },
      ],
    });
    const m = calcularMetricas(c, ctx, HOY);
    const r = validarContratoCompleto(ctx, m, HOY, params());
    expect(r.issues.some((i) => i.area === 'Subcontratos' && i.severidad === 'Alta')).toBe(true);
    expect(r.issues.some((i) => i.area === 'Subcontratos' && i.severidad === 'Media' && i.campo === 'fechaFin')).toBe(true);
  });

  it('liquidación: terminado sin acta de liquidación (Media); liquidado con saldo (Baja)', () => {
    const c = contratoSano({ estado: 'Terminado' });
    const ctx = ctxDe(c, { guarantees: [{ id: 'GR-1', tipo: 'Cumplimiento', poliza: 'PL-1', aseguradora: 'SE', estado: 'Aprobada', valor: 100, fechaVenc: '2027-01-01' }] });
    const m = calcularMetricas(c, ctx, HOY);
    const r = validarContratoCompleto(ctx, m, HOY, params());
    expect(r.issues.some((i) => i.area === 'Liquidación' && i.severidad === 'Media')).toBe(true);

    const c2 = contratoSano({ estado: 'Liquidado' });
    const ctx2 = ctxDe(c2, { guarantees: [] });
    const m2 = calcularMetricas(c2, ctx2, HOY);
    const r2 = validarContratoCompleto(ctx2, m2, HOY, params());
    expect(r2.issues.some((i) => i.area === 'Liquidación' && i.severidad === 'Baja' && i.campo === 'saldo')).toBe(true);
  });

  it('ejecución: >90 % del plazo con <70 % físico (Media)', () => {
    const c = contratoSano({ fechaInicio: '2026-01-01', fechaFin: '2026-10-05', avanceFisico: 30 });
    const ctx = ctxDe(c, {
      execs: [{ periodo: '2026-09', valor: 500_000 }],
    });
    const m = calcularMetricas(c, ctx, HOY);
    const r = validarContratoCompleto(ctx, m, HOY, params());
    expect(r.issues.some((i) => i.area === 'Ejecución' && i.mensaje.includes('90 % del plazo'))).toBe(true);
  });
});

describe('Validator.draft · formulario de contrato', () => {
  it('alta (fin < inicio) bloquea; media no bloquea', () => {
    expect(bloqueaGuardado(validarBorrador({ fechaInicio: '2026-06-01', fechaFin: '2026-05-01' }))).toBe(true);
    expect(bloqueaGuardado(validarBorrador({ fechaFirma: '2026-06-01', fechaInicio: '2026-05-01' }))).toBe(false);
    expect(bloqueaGuardado(validarBorrador({ avanceFisico: 120 }))).toBe(true);
  });
});
