/** Helper para construir contextos de contrato en los tests de los motores. */
import { ContractBase, ContractCtx, PARAMETROS_DEFECTO, ParametrosAlerta } from './types';

export const HOY = '2026-10-01';

export function contratoSano(overrides: Partial<ContractBase> = {}): ContractBase {
  return {
    id: 'CT-99',
    numero: '999-2026',
    estado: 'Activo',
    anulado: false,
    fechaFirma: '2026-05-01',
    fechaInicio: '2026-05-10',
    fechaFin: '2026-12-31',
    valorBase: 1_000_000,
    iva: 190_000,
    otrosImp: 0,
    adiciones: 0,
    reducciones: 0,
    avanceFisico: 50,
    contratista: 'ACME S.A.S.',
    nitContratista: '900.999.999-9',
    objeto: 'Objeto de prueba',
    responsable: 'Responsable',
    supervisor: 'Supervisor',
    deptos: ['08'],
    ...overrides,
  };
}

export function ctxDe(contrato: ContractBase, overrides: Partial<ContractCtx> = {}): ContractCtx {
  return {
    contract: contrato,
    execs: [],
    payments: [],
    guarantees: [],
    obligations: [],
    breaches: [],
    risks: [],
    deliverables: [],
    documents: [
      { id: 'DOC-1', categoria: 'Contrato' },
      { id: 'DOC-2', categoria: 'Propuesta' },
      { id: 'DOC-3', categoria: 'Garantías' },
      { id: 'DOC-4', categoria: 'Actas' },
    ],
    subcontracts: [],
    modifications: [],
    plans: [],
    actas: [],
    auditCount: 2,
    ...overrides,
  };
}

export function params(overrides: Partial<ParametrosAlerta> = {}): ParametrosAlerta {
  return { ...PARAMETROS_DEFECTO, ...overrides };
}
