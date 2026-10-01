/** Parámetros configurables del negocio (Configuración → Parámetros de alertas). */
export interface ParametrosAlerta {
  /** Umbrales de alerta en días, descendente. */
  alertDays: number[];
  /** Días críticos. */
  criticalDays: number;
  /** % saldo que dispara la alerta de presupuesto. */
  budgetPct: number;
  /** Brecha (pp) entre ejecución financiera y física. */
  gapPct: number;
}

export const PARAMETROS_DEFECTO: ParametrosAlerta = {
  alertDays: [30, 15, 10, 5, 3, 1],
  criticalDays: 5,
  budgetPct: 15,
  gapPct: 20,
};

export const ESTADOS_CERRADOS = ['Terminado', 'En liquidación', 'Liquidado', 'Anulado'];

export const DOCS_REQUERIDOS = ['Contrato', 'Propuesta', 'Garantías', 'Actas'];

export interface ContractBase {
  id: string;
  numero: string;
  estado: string;
  anulado: boolean;
  fechaFirma?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  valorBase?: number | null;
  iva?: number | null;
  otrosImp?: number | null;
  adiciones?: number | null;
  reducciones?: number | null;
  avanceFisico?: number | null;
  contratista?: string | null;
  nitContratista?: string | null;
  objeto?: string | null;
  responsable?: string | null;
  supervisor?: string | null;
  deptos?: string[] | null;
}

export interface ExecRow { periodo: string; valor: number; anulado?: boolean }
export interface PaymentRow {
  id?: string; estado?: string; bruto: number; iva?: number; retenciones?: number;
  neto?: number; soporte?: string | null; anulado?: boolean;
}
export interface GuaranteeRow {
  id: string; tipo: string; poliza: string; aseguradora: string; estado?: string;
  valor: number; porcentaje?: number | null; fechaInicio?: string | null;
  fechaVenc?: string | null; anulado?: boolean;
}
export interface ObligationRow {
  id: string; estado?: string; fechaLimite?: string | null; anulado?: boolean;
}
export interface BreachRow { id: string; estado?: string; impacto?: string; anulado?: boolean }
export interface RiskRow {
  id: string; prob: number; impacto: number; estado?: string; mitigacion?: string | null; anulado?: boolean;
}
export interface DeliverableRow {
  id: string; estado?: string; fechaProg?: string | null; fechaReal?: string | null; anulado?: boolean;
}
export interface DocumentRow { id: string; categoria: string; estado?: string; anulado?: boolean }
export interface SubcontractRow { id: string; valor: number; fechaFin?: string | null; estado?: string; anulado?: boolean }
export interface ModificationRow {
  id: string; tipo: string; fecha?: string | null; valorAnterior?: number | null;
  valorNuevo?: number | null; fechaNueva?: string | null; estado?: string; anulado?: boolean;
}
export interface PlanRow { id: string; estado?: string; avance?: number | null; anulado?: boolean }

export interface ActaRow { id: string; tipo?: string; estado?: string; anulado?: boolean }

/** Agregados de un contrato: insumo de M(c), semáforo, validador y alertas. */
export interface ContractCtx {
  contract: ContractBase;
  execs: ExecRow[];
  payments: PaymentRow[];
  guarantees: GuaranteeRow[];
  obligations: ObligationRow[];
  breaches: BreachRow[];
  risks: RiskRow[];
  deliverables: DeliverableRow[];
  documents: DocumentRow[];
  subcontracts: SubcontractRow[];
  modifications: ModificationRow[];
  plans: PlanRow[];
  actas: ActaRow[];
  auditCount: number;
}

export type NivelRiesgo = 'Bajo' | 'Moderado' | 'Alto' | 'Extremo';

/** Nivel de un riesgo: probabilidad × impacto (files/09: Bajo 1–4, Moderado 5–9, Alto 10–14, Extremo 15–25). */
export function nivelRiesgo(prob: number, impacto: number): NivelRiesgo {
  const s = prob * impacto;
  if (s <= 4) return 'Bajo';
  if (s <= 9) return 'Moderado';
  if (s <= 14) return 'Alto';
  return 'Extremo';
}
