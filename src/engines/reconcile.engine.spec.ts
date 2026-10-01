import { conciliar, duracionDe } from './reconcile.engine';

describe('Conciliación contractual (files/05 §5)', () => {
  const sistema = {
    valorInicial: 1_000_000,
    fechaInicio: '2026-01-10',
    fechaFin: '2026-06-10',
    duracionDias: 153,
    objeto: 'Servicios de consultoría',
    contratista: 'Acme S.A.S.',
    nitContratista: '900.111.222-3',
    tiposGarantia: ['Cumplimiento', 'Calidad'],
  };

  it('sin documento con extracted ⇒ no disponible', () => {
    const r = conciliar(sistema, null);
    expect(r.disponible).toBe(false);
    expect(r.campos).toHaveLength(0);
  });

  it('todos los campos coinciden', () => {
    const r = conciliar(sistema, {
      valor: 1_000_000, fechaInicio: '2026-01-10', fechaFin: '2026-06-10', plazoDias: 153,
      objeto: 'Servicios de consultoría', contratista: 'acme s.a.s.', nit: '9001112223',
      garantias: ['Cumplimiento', 'Calidad'],
    });
    expect(r.disponible).toBe(true);
    expect(r.diferencias).toBe(0);
    expect(r.campos.every((c) => c.coincide === true)).toBe(true);
  });

  it('valor con diferencia menor a un peso coincide; mayor, no', () => {
    expect(conciliar(sistema, { valor: 999_999.5 }).campos.find((c) => c.campo === 'Valor')?.coincide).toBe(true);
    expect(conciliar(sistema, { valor: 999_000 }).campos.find((c) => c.campo === 'Valor')?.coincide).toBe(false);
  });

  it('NIT ignora puntos y guiones', () => {
    const r = conciliar(sistema, { nit: '900-111-222-3' });
    expect(r.campos.find((c) => c.campo === 'NIT')?.coincide).toBe(true);
  });

  it('contratista sin distinguir mayúsculas y objeto sin espacios en extremos', () => {
    const r = conciliar(sistema, { contratista: 'ACME S.A.S.', objeto: '  Servicios de consultoría  ' });
    expect(r.campos.find((c) => c.campo === 'Contratista')?.coincide).toBe(true);
    expect(r.campos.find((c) => c.campo === 'Objeto')?.coincide).toBe(true);
  });

  it('plazo distinto ⇒ diferencia; duraciónDe calcula fin − inicio + 1', () => {
    const r = conciliar(sistema, { plazoDias: 150 });
    expect(r.campos.find((c) => c.campo === 'Plazo (días)')?.coincide).toBe(false);
    expect(duracionDe('2026-01-10', '2026-06-10')).toBe(152);
  });

  it('garantías: igualdad de tipos cuando el documento los indica', () => {
    expect(conciliar(sistema, { garantias: ['Calidad', 'Cumplimiento'] }).campos.find((c) => c.campo === 'Garantías')?.coincide).toBe(true);
    expect(conciliar(sistema, { garantias: ['Cumplimiento'] }).campos.find((c) => c.campo === 'Garantías')?.coincide).toBe(false);
  });
});
