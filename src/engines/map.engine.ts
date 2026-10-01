/** Departamentos de Colombia: código DANE → nombre y región (files/07). */
export const DEPARTAMENTOS: Record<string, { nombre: string; region: string }> = {
  '05': { nombre: 'Antioquia', region: 'Andina' },
  '08': { nombre: 'Atlántico', region: 'Caribe' },
  '11': { nombre: 'Bogotá, D.C.', region: 'Andina' },
  '13': { nombre: 'Bolívar', region: 'Caribe' },
  '15': { nombre: 'Boyacá', region: 'Andina' },
  '17': { nombre: 'Caldas', region: 'Andina' },
  '18': { nombre: 'Caquetá', region: 'Amazonía' },
  '19': { nombre: 'Cauca', region: 'Pacífica' },
  '20': { nombre: 'Cesar', region: 'Caribe' },
  '23': { nombre: 'Córdoba', region: 'Caribe' },
  '25': { nombre: 'Cundinamarca', region: 'Andina' },
  '27': { nombre: 'Chocó', region: 'Pacífica' },
  '41': { nombre: 'Huila', region: 'Andina' },
  '44': { nombre: 'La Guajira', region: 'Caribe' },
  '47': { nombre: 'Magdalena', region: 'Caribe' },
  '50': { nombre: 'Meta', region: 'Orinoquía' },
  '52': { nombre: 'Nariño', region: 'Pacífica' },
  '54': { nombre: 'Norte de Santander', region: 'Andina' },
  '63': { nombre: 'Quindío', region: 'Andina' },
  '66': { nombre: 'Risaralda', region: 'Andina' },
  '68': { nombre: 'Santander', region: 'Andina' },
  '70': { nombre: 'Sucre', region: 'Caribe' },
  '73': { nombre: 'Tolima', region: 'Andina' },
  '76': { nombre: 'Valle del Cauca', region: 'Pacífica' },
  '81': { nombre: 'Arauca', region: 'Orinoquía' },
  '85': { nombre: 'Casanare', region: 'Orinoquía' },
  '86': { nombre: 'Putumayo', region: 'Amazonía' },
  '88': { nombre: 'San Andrés, Providencia y Santa Catalina', region: 'Insular' },
  '91': { nombre: 'Amazonas', region: 'Amazonía' },
  '94': { nombre: 'Guainía', region: 'Amazonía' },
  '95': { nombre: 'Guaviare', region: 'Amazonía' },
  '97': { nombre: 'Vaupés', region: 'Amazonía' },
  '99': { nombre: 'Vichada', region: 'Orinoquía' },
};

export const REGIONES = ['Caribe', 'Andina', 'Pacífica', 'Orinoquía', 'Amazonía', 'Insular'] as const;

export interface ContratoMapa {
  id: string;
  companyId?: string | null;
  deptos: string[];
  valorActual: number;
  nitContratista: string;
  estado: string;
  anulado: boolean;
}

export interface GarantiaMapa {
  contractId: string;
  valor: number;
  aseguradora: string;
  anulado?: boolean;
  estado?: string;
}

export interface RegistroGeo {
  codigoDane: string;
  nombre: string;
  region: string;
  contratos: number;
  valorContratado: number;
  polizas: number;
  valorAsegurado: number;
  clientes: number;
}

/** Filtros del mapa (files/07). */
export interface FiltrosMapa {
  /** Grupo de estado: todos | ejecucion | suspendido | liquidacion | liquidado | terminado */
  estadoGrupo?: string;
  aseguradora?: string;
  companyId?: string;
  /** Métrica para la burbuja: contratos | polizas | clientes */
  metric?: string;
  /** Medida: n (cantidad) | v (valor) */
  measure?: string;
}

export const GRUPOS_ESTADO: Record<string, (estado: string) => boolean> = {
  todos: () => true,
  ejecucion: (e) => e === 'Activo', // activos y vencidos (el vencido sigue siendo Activo)
  suspendido: (e) => e === 'Suspendido',
  liquidacion: (e) => e === 'En liquidación',
  liquidado: (e) => e === 'Liquidado',
  terminado: (e) => e === 'Terminado',
};

/** Filtra los contratos por estado/empresa. */
export function contratosParaMapa(contratos: ContratoMapa[], f: FiltrosMapa): ContratoMapa[] {
  const grupo = GRUPOS_ESTADO[f.estadoGrupo ?? 'todos'] ?? GRUPOS_ESTADO.todos;
  return contratos.filter(
    (c) => !c.anulado && grupo(c.estado) && (!f.companyId || c.companyId === f.companyId),
  );
}

/** Agregado por departamento. Un contrato multicobertura cuenta en cada uno de sus deptos. */
export function agregarPorDepto(
  contratos: ContratoMapa[],
  garantias: GarantiaMapa[],
  f: FiltrosMapa,
): RegistroGeo[] {
  const filtrados = contratos.filter((c) => contratosParaMapa([c], f).length > 0);
  const porDepto = new Map<string, ContratoMapa[]>();
  for (const c of filtrados) {
    for (const cod of c.deptos) {
      if (!DEPARTAMENTOS[cod]) continue;
      const arr = porDepto.get(cod) ?? [];
      arr.push(c);
      porDepto.set(cod, arr);
    }
  }
  const out: RegistroGeo[] = [];
  for (const [cod, cs] of porDepto) {
    const ids = new Set(cs.map((c) => c.id));
    let polizas = garantias.filter(
      (g) => !g.anulado && ids.has(g.contractId) &&
        (!f.aseguradora || g.aseguradora === f.aseguradora),
    );
    if (f.aseguradora) {
      // Solo contratos con pólizas de esa aseguradora
      const conPoliza = new Set(polizas.map((g) => g.contractId));
      polizas = garantias.filter((g) => !g.anulado && conPoliza.has(g.contractId));
    }
    out.push({
      codigoDane: cod,
      nombre: DEPARTAMENTOS[cod].nombre,
      region: DEPARTAMENTOS[cod].region,
      contratos: cs.length,
      valorContratado: cs.reduce((s, c) => s + c.valorActual, 0),
      polizas: polizas.length,
      valorAsegurado: polizas.reduce((s, g) => s + g.valor, 0),
      clientes: new Set(cs.map((c) => c.nitContratista)).size,
    });
  }
  return [...out].sort((a, b) => a.codigoDane.localeCompare(b.codigoDane));
}

/** Agregado por región: cada contrato/póliza/cliente cuenta UNA sola vez por región. */
export function agregarPorRegion(
  contratos: ContratoMapa[],
  garantias: GarantiaMapa[],
  f: FiltrosMapa,
): RegistroGeo[] {
  const filtrados = contratos.filter((c) => contratosParaMapa([c], f).length > 0);
  const porRegion = new Map<string, ContratoMapa[]>();
  for (const c of filtrados) {
    for (const cod of c.deptos) {
      const region = DEPARTAMENTOS[cod]?.region;
      if (!region) continue;
      const arr = porRegion.get(region) ?? [];
      if (!arr.some((x) => x.id === c.id)) arr.push(c);
      porRegion.set(region, arr);
    }
  }
  const out: RegistroGeo[] = [];
  for (const [region, cs] of porRegion) {
    const ids = new Set(cs.map((c) => c.id));
    let polizas = garantias.filter(
      (g) => !g.anulado && ids.has(g.contractId) && (!f.aseguradora || g.aseguradora === f.aseguradora),
    );
    if (f.aseguradora) {
      const conPoliza = new Set(polizas.map((g) => g.contractId));
      polizas = garantias.filter((g) => !g.anulado && conPoliza.has(g.contractId));
    }
    out.push({
      codigoDane: region,
      nombre: region,
      region,
      contratos: cs.length,
      valorContratado: cs.reduce((s, c) => s + c.valorActual, 0),
      polizas: polizas.length,
      valorAsegurado: polizas.reduce((s, g) => s + g.valor, 0),
      clientes: new Set(cs.map((c) => c.nitContratista)).size,
    });
  }
  return REGIONES.map((r) => out.find((x) => x.region === r) ?? vacia(r, r));
}

function vacia(nombre: string, region: string): RegistroGeo {
  return {
    codigoDane: nombre,
    nombre,
    region,
    contratos: 0,
    valorContratado: 0,
    polizas: 0,
    valorAsegurado: 0,
    clientes: 0,
  };
}

/** Totales nacionales (cada contrato, póliza y cliente una sola vez). */
export function totalesNacionales(
  contratos: ContratoMapa[],
  garantias: GarantiaMapa[],
  f: FiltrosMapa,
): { contratos: number; valor: number; polizas: number; valorAsegurado: number; clientes: number } {
  const filtrados = contratos.filter((c) => contratosParaMapa([c], f).length > 0);
  const ids = new Set(filtrados.map((c) => c.id));
  const polizas = garantias.filter(
    (g) => !g.anulado && ids.has(g.contractId) && (!f.aseguradora || g.aseguradora === f.aseguradora),
  );
  return {
    contratos: filtrados.length,
    valor: filtrados.reduce((s, c) => s + c.valorActual, 0),
    polizas: polizas.length,
    valorAsegurado: polizas.reduce((s, g) => s + g.valor, 0),
    clientes: new Set(filtrados.map((c) => c.nitContratista)).size,
  };
}
