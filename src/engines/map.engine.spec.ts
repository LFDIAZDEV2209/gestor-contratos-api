import { agregarPorDepto, agregarPorRegion, totalesNacionales, ContratoMapa, GarantiaMapa } from './map.engine';

const contratos: ContratoMapa[] = [
  // CT-A: cubre Barranquilla y Bolívar (Caribe) — valor 1M, un cliente
  { id: 'CT-A', companyId: 'EMP-1', deptos: ['08', '13'], valorActual: 1_000_000, nitContratista: '900-1', estado: 'Activo', anulado: false },
  // CT-B: cubre Bogotá (Andina) — valor 2M, otro cliente
  { id: 'CT-B', companyId: 'EMP-2', deptos: ['11'], valorActual: 2_000_000, nitContratista: '900-2', estado: 'Activo', anulado: false },
  // CT-C: anulado, no cuenta
  { id: 'CT-C', companyId: 'EMP-1', deptos: ['08'], valorActual: 5_000_000, nitContratista: '900-3', estado: 'Activo', anulado: true },
];

const garantias: GarantiaMapa[] = [
  { contractId: 'CT-A', valor: 100_000, aseguradora: 'SE', anulado: false },
  { contractId: 'CT-A', valor: 50_000, aseguradora: 'SURA', anulado: false },
  { contractId: 'CT-B', valor: 200_000, aseguradora: 'SE', anulado: false },
  { contractId: 'CT-A', valor: 999_999, aseguradora: 'SE', anulado: true },
];

describe('agregados del mapa (files/07)', () => {
  it('por departamento: el contrato multicobertura cuenta en cada depto', () => {
    const r = agregarPorDepto(contratos, garantias, {});
    const atl = r.find((x) => x.codigoDane === '08');
    const bol = r.find((x) => x.codigoDane === '13');
    const bog = r.find((x) => x.codigoDane === '11');
    expect(atl).toMatchObject({ nombre: 'Atlántico', region: 'Caribe', contratos: 1, valorContratado: 1_000_000, clientes: 1 });
    expect(bol).toMatchObject({ contratos: 1, valorContratado: 1_000_000 });
    expect(bog).toMatchObject({ region: 'Andina', contratos: 1, valorContratado: 2_000_000 });
  });

  it('pólizas y valor asegurado por departamento excluyen anuladas', () => {
    const r = agregarPorDepto(contratos, garantias, {});
    const atl = r.find((x) => x.codigoDane === '08');
    expect(atl?.polizas).toBe(2);
    expect(atl?.valorAsegurado).toBe(150_000);
  });

  it('por región: cada contrato cuenta UNA sola vez aunque cubra varios deptos', () => {
    const r = agregarPorRegion(contratos, garantias, {});
    const caribe = r.find((x) => x.region === 'Caribe');
    expect(caribe?.contratos).toBe(1); // CT-A una vez (no dos por 08 y 13)
    expect(caribe?.valorContratado).toBe(1_000_000);
    expect(caribe?.polizas).toBe(2);
    expect(caribe?.valorAsegurado).toBe(150_000);
    expect(caribe?.clientes).toBe(1);
  });

  it('filtros: aseguradora limita pólizas a los contratos con ella', () => {
    const r = agregarPorRegion(contratos, garantias, { aseguradora: 'SURA' });
    const caribe = r.find((x) => x.region === 'Caribe');
    // Solo contratos con pólizas SURA; sus pólizas (todas) cuentan
    expect(caribe?.polizas).toBe(2);
    const se = agregarPorDepto(contratos, garantias, { aseguradora: 'SE' });
    const bog = se.find((x) => x.codigoDane === '11');
    expect(bog?.polizas).toBe(1);
  });

  it('filtro de estado por grupo (ejecución excluye suspendidos, etc.)', () => {
    const conSuspendido: ContratoMapa[] = [...contratos, { id: 'CT-D', companyId: 'EMP-2', deptos: ['11'], valorActual: 4_000_000, nitContratista: '900-4', estado: 'Suspendido', anulado: false }];
    const r = agregarPorDepto(conSuspendido, garantias, { estadoGrupo: 'ejecucion' });
    const bog = r.find((x) => x.codigoDane === '11');
    expect(bog?.contratos).toBe(1); // solo CT-B (CT-D suspendido)
  });

  it('totales nacionales: cada contrato, póliza y cliente una sola vez', () => {
    const t = totalesNacionales(contratos, garantias, {});
    expect(t.contratos).toBe(2); // sin CT-C anulado
    expect(t.valor).toBe(3_000_000);
    expect(t.polizas).toBe(3);
    expect(t.clientes).toBe(2);
  });

  it('empresa contratante filtra los contratos', () => {
    const t = totalesNacionales(contratos, garantias, { companyId: 'EMP-2' });
    expect(t.contratos).toBe(1);
    expect(t.valor).toBe(2_000_000);
  });
});
