import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex, TableColumnOptions } from 'typeorm';

const DINERO = { type: 'bigint' as const };
const FECHA = { type: 'date' as const };
const TEXTO = { type: 'text' as const };
const PCT = { type: 'numeric' as const, precision: 5, scale: 2 };
const TS = { type: 'timestamptz' as const };

/** Columnas comunes de negocio (id texto con prefijo + version + auditoría de fila). */
function comunes(): TableColumnOptions[] {
  return [
    { name: 'id', type: 'text', isPrimary: true },
    { name: 'version', type: 'int', default: 1, isNullable: false },
  ];
}

const FECHAS_FILA: TableColumnOptions[] = [
  { name: 'created_at', type: 'timestamptz', default: 'now()' },
  { name: 'updated_at', type: 'timestamptz', default: 'now()' },
];

/** Índice simple o único sobre una tabla existente. */
async function creaIndice(
  qr: QueryRunner, tabla: string, nombre: string, columnas: string[], unico = false,
): Promise<void> {
  await qr.createIndex(tabla, new TableIndex({ name: nombre, columnNames: columnas, isUnique: unico }));
}

const fkContrato = (tabla: string): TableForeignKey =>
  new TableForeignKey({
    name: `fk_${tabla}_contract`,
    columnNames: ['contract_id'],
    referencedTableName: 'contracts',
    referencedColumnNames: ['id'],
    onDelete: 'RESTRICT',
  });

/** Esquema completo de files/02 en 3NF + trigger INSERT-only de auditoría. */
export class InitialSchema1727900000000 implements MigrationInterface {
  name = 'InitialSchema1727900000000';

  async up(qr: QueryRunner): Promise<void> {
    // ── Empresas ────────────────────────────────────────────────────────────
    await qr.createTable(new Table({
      name: 'companies',
      columns: [
        ...comunes(),
        { name: 'razon', type: 'text', isNullable: false },
        { name: 'nit', type: 'text', isNullable: false },
        { name: 'tipo', type: 'text', isNullable: true },
        { name: 'direccion', type: 'text', isNullable: true },
        { name: 'ciudad', type: 'text', isNullable: true },
        { name: 'depto', type: 'text', isNullable: true },
        { name: 'pais', type: 'text', isNullable: true },
        { name: 'rep', type: 'text', isNullable: true },
        { name: 'rep_doc', type: 'text', isNullable: true },
        { name: 'tel', type: 'text', isNullable: true },
        { name: 'email', type: 'text', isNullable: true },
        { name: 'resp_interno', type: 'text', isNullable: true },
        { name: 'estado', type: 'text', default: "'Activa'" },
        { name: 'fecha_creacion', type: 'date', isNullable: true },
        { name: 'motivo_anulacion', type: 'text', isNullable: true },
        ...FECHAS_FILA,
      ],
    }));
    await creaIndice(qr, 'companies', 'ux_companies_nit', ['nit'], true);
    await creaIndice(qr, 'companies', 'ix_companies_estado', ['estado']);

    // ── Contratos ───────────────────────────────────────────────────────────
    await qr.createTable(new Table({
      name: 'contracts',
      columns: [
        ...comunes(),
        { name: 'numero', type: 'text', isNullable: false },
        { name: 'tipo', type: 'text', isNullable: false },
        { name: 'modalidad', type: 'text', isNullable: true },
        { name: 'company_id', type: 'text', isNullable: false },
        { name: 'estado', type: 'text', default: "'Borrador'" },
        { name: 'contratista', type: 'text', isNullable: false },
        { name: 'nit_contratista', type: 'text', isNullable: false },
        { name: 'rep_contratista', type: 'text', isNullable: true },
        { name: 'area', type: 'text', isNullable: true },
        { name: 'objeto', type: 'text', isNullable: false },
        { name: 'descripcion', type: 'text', isNullable: true },
        { name: 'responsable', type: 'text', isNullable: false },
        { name: 'supervisor', type: 'text', isNullable: false },
        { name: 'interventor', type: 'text', isNullable: true },
        { name: 'deptos', type: 'jsonb', default: "'[]'::jsonb" },
        { name: 'municipio', type: 'text', isNullable: true },
        { name: 'fecha_firma', type: 'date', isNullable: true },
        { name: 'fecha_inicio', type: 'date', isNullable: true },
        { name: 'fecha_fin', type: 'date', isNullable: true },
        { name: 'hasta_agotar', type: 'boolean', default: false },
        { name: 'valor_base', type: 'bigint', isNullable: false },
        { name: 'iva', type: 'bigint', default: 0 },
        { name: 'otros_imp', type: 'bigint', default: 0 },
        { name: 'adiciones', type: 'bigint', default: 0 },
        { name: 'reducciones', type: 'bigint', default: 0 },
        { name: 'avance_fisico', type: 'numeric', precision: 5, scale: 2, isNullable: true },
        { name: 'alcance', type: 'text', isNullable: true },
        { name: 'productos', type: 'text', isNullable: true },
        { name: 'indicadores', type: 'text', isNullable: true },
        { name: 'anulado', type: 'boolean', default: false },
        { name: 'motivo_anulacion', type: 'text', isNullable: true },
        ...FECHAS_FILA,
      ],
      foreignKeys: [
        new TableForeignKey({ name: 'fk_contracts_company', columnNames: ['company_id'], referencedTableName: 'companies', referencedColumnNames: ['id'], onDelete: 'RESTRICT' }),
      ],
    }));
    await creaIndice(qr, 'contracts', 'ux_contracts_numero', ['numero'], true);
    await creaIndice(qr, 'contracts', 'ix_contracts_company', ['company_id']);
    await creaIndice(qr, 'contracts', 'ix_contracts_estado', ['estado']);
    await creaIndice(qr, 'contracts', 'ix_contracts_fecha_fin', ['fecha_fin']);
    await creaIndice(qr, 'contracts', 'ix_contracts_anulado', ['anulado']);

    // ── Cupos (antes de garantías) ─────────────────────────────────────────
    await qr.createTable(new Table({
      name: 'cupos',
      columns: [
        ...comunes(),
        { name: 'aseguradora', type: 'text', isNullable: false },
        { name: 'numero', type: 'text', isNullable: false },
        { name: 'tomador', type: 'text', isNullable: false },
        { name: 'intermediario', type: 'text', isNullable: true },
        { name: 'valor', type: 'bigint', isNullable: false },
        { name: 'fecha_inicio', type: 'date', isNullable: true },
        { name: 'fecha_venc', type: 'date', isNullable: true },
        { name: 'estado', type: 'text', default: "'Vigente'" },
        { name: 'observaciones', type: 'text', isNullable: true },
        { name: 'motivo_anulacion', type: 'text', isNullable: true },
        ...FECHAS_FILA,
      ],
    }));
    await creaIndice(qr, 'cupos', 'ix_cupos_aseguradora', ['aseguradora']);
    await creaIndice(qr, 'cupos', 'ix_cupos_estado', ['estado']);
    await creaIndice(qr, 'cupos', 'ix_cupos_fecha_venc', ['fecha_venc']);

    // ── Hijas del contrato ─────────────────────────────────────────────────
    await qr.createTable(new Table({
      name: 'subcontracts',
      columns: [
        ...comunes(),
        { name: 'contract_id', type: 'text', isNullable: false },
        { name: 'numero', type: 'text', isNullable: false },
        { name: 'contratista', type: 'text', isNullable: false },
        { name: 'nit', type: 'text', isNullable: false },
        { name: 'objeto', type: 'text', isNullable: false },
        { name: 'valor', type: 'bigint', isNullable: false },
        { name: 'fecha_inicio', type: 'date', isNullable: true },
        { name: 'fecha_fin', type: 'date', isNullable: true },
        { name: 'estado', type: 'text', default: "'Activo'" },
        { name: 'ejecucion', type: 'numeric', precision: 5, scale: 2, isNullable: true },
        { name: 'responsable', type: 'text', isNullable: true },
        { name: 'documentos', type: 'text', isNullable: true },
        { name: 'riesgos', type: 'text', isNullable: true },
        { name: 'obligaciones', type: 'text', isNullable: true },
        { name: 'motivo_anulacion', type: 'text', isNullable: true },
        ...FECHAS_FILA,
      ],
      foreignKeys: [fkContrato('subcontracts')],
    }));
    await creaIndice(qr, 'subcontracts', 'ix_subcontracts_contract', ['contract_id']);
    await creaIndice(qr, 'subcontracts', 'ix_subcontracts_estado', ['estado']);

    await qr.createTable(new Table({
      name: 'obligations',
      columns: [
        ...comunes(),
        { name: 'contract_id', type: 'text', isNullable: false },
        { name: 'tipo', type: 'text', isNullable: true },
        { name: 'descripcion', type: 'text', isNullable: false },
        { name: 'responsable', type: 'text', isNullable: false },
        { name: 'fecha_limite', type: 'date', isNullable: true },
        { name: 'periodicidad', type: 'text', isNullable: true },
        { name: 'evidencia', type: 'text', isNullable: true },
        { name: 'estado', type: 'text', default: "'Pendiente'" },
        { name: 'cumplimiento', type: 'numeric', precision: 5, scale: 2, isNullable: true },
        { name: 'obs', type: 'text', isNullable: true },
        { name: 'motivo_anulacion', type: 'text', isNullable: true },
        ...FECHAS_FILA,
      ],
      foreignKeys: [fkContrato('obligations')],
    }));
    await creaIndice(qr, 'obligations', 'ix_obligations_contract', ['contract_id']);
    await creaIndice(qr, 'obligations', 'ix_obligations_estado', ['estado']);
    await creaIndice(qr, 'obligations', 'ix_obligations_fecha_limite', ['fecha_limite']);

    await qr.createTable(new Table({
      name: 'obligation_checklist',
      columns: [
        { name: 'id', type: 'text', isPrimary: true },
        { name: 'obligation_id', type: 'text', isNullable: false },
        { name: 'texto', type: 'text', isNullable: false },
        { name: 'hecho', type: 'boolean', default: false },
        { name: 'orden', type: 'int', default: 0 },
        { name: 'created_at', type: 'timestamptz', default: 'now()' },
      ],
      foreignKeys: [new TableForeignKey({ name: 'fk_obchecklist_obligation', columnNames: ['obligation_id'], referencedTableName: 'obligations', referencedColumnNames: ['id'], onDelete: 'CASCADE' })],
    }));
    await creaIndice(qr, 'obligation_checklist', 'ix_obchecklist_obligation', ['obligation_id']);

    await qr.createTable(new Table({
      name: 'obligation_comments',
      columns: [
        { name: 'id', type: 'text', isPrimary: true },
        { name: 'obligation_id', type: 'text', isNullable: false },
        { name: 'usuario', type: 'text', isNullable: false },
        { name: 'texto', type: 'text', isNullable: false },
        { name: 'created_at', type: 'timestamptz', default: 'now()' },
      ],
      foreignKeys: [new TableForeignKey({ name: 'fk_obcomments_obligation', columnNames: ['obligation_id'], referencedTableName: 'obligations', referencedColumnNames: ['id'], onDelete: 'CASCADE' })],
    }));
    await creaIndice(qr, 'obligation_comments', 'ix_obcomments_obligation', ['obligation_id']);

    await qr.createTable(new Table({
      name: 'obligation_evidences',
      columns: [
        { name: 'id', type: 'text', isPrimary: true },
        { name: 'obligation_id', type: 'text', isNullable: false },
        { name: 'nombre', type: 'text', isNullable: false },
        { name: 'archivo', type: 'text', isNullable: false },
        { name: 'usuario', type: 'text', isNullable: false },
        { name: 'created_at', type: 'timestamptz', default: 'now()' },
      ],
      foreignKeys: [new TableForeignKey({ name: 'fk_obevidences_obligation', columnNames: ['obligation_id'], referencedTableName: 'obligations', referencedColumnNames: ['id'], onDelete: 'CASCADE' })],
    }));
    await creaIndice(qr, 'obligation_evidences', 'ix_obevidences_obligation', ['obligation_id']);

    await qr.createTable(new Table({
      name: 'deliverables',
      columns: [
        ...comunes(),
        { name: 'contract_id', type: 'text', isNullable: false },
        { name: 'nombre', type: 'text', isNullable: false },
        { name: 'descripcion', type: 'text', isNullable: true },
        { name: 'fecha_inicio', type: 'date', isNullable: true },
        { name: 'fecha_prog', type: 'date', isNullable: true },
        { name: 'fecha_real', type: 'date', isNullable: true },
        { name: 'responsable', type: 'text', isNullable: true },
        { name: 'estado', type: 'text', default: "'Pendiente'" },
        { name: 'avance', type: 'numeric', precision: 5, scale: 2, isNullable: true },
        { name: 'evidencia', type: 'text', isNullable: true },
        { name: 'obs', type: 'text', isNullable: true },
        { name: 'motivo_anulacion', type: 'text', isNullable: true },
        ...FECHAS_FILA,
      ],
      foreignKeys: [fkContrato('deliverables')],
    }));
    await creaIndice(qr, 'deliverables', 'ix_deliverables_contract', ['contract_id']);
    await creaIndice(qr, 'deliverables', 'ix_deliverables_estado', ['estado']);

    await qr.createTable(new Table({
      name: 'execs',
      columns: [
        ...comunes(),
        { name: 'contract_id', type: 'text', isNullable: false },
        { name: 'periodo', type: 'text', isNullable: false },
        { name: 'valor', type: 'bigint', isNullable: false },
        { name: 'avance_fisico', type: 'numeric', precision: 5, scale: 2, isNullable: false },
        { name: 'obs', type: 'text', isNullable: true },
        { name: 'motivo_anulacion', type: 'text', isNullable: true },
        ...FECHAS_FILA,
      ],
      foreignKeys: [fkContrato('execs')],
    }));
    await creaIndice(qr, 'execs', 'ix_execs_contract', ['contract_id']);
    await creaIndice(qr, 'execs', 'ux_execs_contract_periodo', ['contract_id', 'periodo'], true);

    await qr.createTable(new Table({
      name: 'payments',
      columns: [
        ...comunes(),
        { name: 'contract_id', type: 'text', isNullable: false },
        { name: 'numero', type: 'text', isNullable: false },
        { name: 'fecha', type: 'date', isNullable: true },
        { name: 'factura', type: 'text', isNullable: false },
        { name: 'periodo', type: 'text', isNullable: true },
        { name: 'bruto', type: 'bigint', isNullable: false },
        { name: 'iva', type: 'bigint', default: 0 },
        { name: 'retenciones', type: 'bigint', default: 0 },
        { name: 'neto', type: 'bigint', isNullable: false },
        { name: 'estado', type: 'text', default: "'Pendiente'" },
        { name: 'fecha_aprob', type: 'date', isNullable: true },
        { name: 'fecha_pago', type: 'date', isNullable: true },
        { name: 'soporte', type: 'text', isNullable: true },
        { name: 'motivo_anulacion', type: 'text', isNullable: true },
        ...FECHAS_FILA,
      ],
      foreignKeys: [fkContrato('payments')],
    }));
    await creaIndice(qr, 'payments', 'ix_payments_contract', ['contract_id']);
    await creaIndice(qr, 'payments', 'ix_payments_estado', ['estado']);
    await creaIndice(qr, 'payments', 'ix_payments_fecha', ['fecha']);

    await qr.createTable(new Table({
      name: 'guarantees',
      columns: [
        ...comunes(),
        { name: 'contract_id', type: 'text', isNullable: false },
        { name: 'tipo', type: 'text', isNullable: false },
        { name: 'aseguradora', type: 'text', isNullable: false },
        { name: 'poliza', type: 'text', isNullable: false },
        { name: 'modalidad_poliza', type: 'text', default: "'Póliza individual'" },
        { name: 'cupo_id', type: 'text', isNullable: true },
        { name: 'porcentaje', type: 'numeric', precision: 5, scale: 2, isNullable: true },
        { name: 'tomador', type: 'text', isNullable: true },
        { name: 'intermediario', type: 'text', isNullable: true },
        { name: 'prima', type: 'bigint', isNullable: true },
        { name: 'valor', type: 'bigint', isNullable: false },
        { name: 'fecha_exp', type: 'date', isNullable: true },
        { name: 'fecha_inicio', type: 'date', isNullable: true },
        { name: 'fecha_venc', type: 'date', isNullable: true },
        { name: 'estado', type: 'text', default: "'Pendiente'" },
        { name: 'documento', type: 'text', isNullable: true },
        { name: 'relacion', type: 'text', isNullable: true },
        { name: 'motivo_anulacion', type: 'text', isNullable: true },
        ...FECHAS_FILA,
      ],
      foreignKeys: [
        fkContrato('guarantees'),
        new TableForeignKey({ name: 'fk_guarantees_cupo', columnNames: ['cupo_id'], referencedTableName: 'cupos', referencedColumnNames: ['id'], onDelete: 'RESTRICT' }),
      ],
    }));
    await creaIndice(qr, 'guarantees', 'ix_guarantees_contract', ['contract_id']);
    await creaIndice(qr, 'guarantees', 'ix_guarantees_aseguradora', ['aseguradora']);
    await creaIndice(qr, 'guarantees', 'ix_guarantees_estado', ['estado']);
    await creaIndice(qr, 'guarantees', 'ix_guarantees_cupo', ['cupo_id']);
    await creaIndice(qr, 'guarantees', 'ix_guarantees_fecha_venc', ['fecha_venc']);

    await qr.createTable(new Table({
      name: 'actas',
      columns: [
        ...comunes(),
        { name: 'contract_id', type: 'text', isNullable: false },
        { name: 'numero', type: 'text', isNullable: false },
        { name: 'tipo', type: 'text', isNullable: false },
        { name: 'fecha', type: 'date', isNullable: true },
        { name: 'valor', type: 'bigint', isNullable: true },
        { name: 'descripcion', type: 'text', isNullable: false },
        { name: 'archivo', type: 'text', isNullable: true },
        { name: 'responsable', type: 'text', isNullable: true },
        { name: 'estado', type: 'text', default: "'Borrador acta'" },
        { name: 'motivo_anulacion', type: 'text', isNullable: true },
        ...FECHAS_FILA,
      ],
      foreignKeys: [fkContrato('actas')],
    }));
    await creaIndice(qr, 'actas', 'ix_actas_contract', ['contract_id']);
    await creaIndice(qr, 'actas', 'ix_actas_tipo', ['tipo']);
    await creaIndice(qr, 'actas', 'ix_actas_estado', ['estado']);
    await creaIndice(qr, 'actas', 'ix_actas_fecha', ['fecha']);

    await qr.createTable(new Table({
      name: 'modifications',
      columns: [
        ...comunes(),
        { name: 'contract_id', type: 'text', isNullable: false },
        { name: 'numero', type: 'text', isNullable: false },
        { name: 'tipo', type: 'text', isNullable: false },
        { name: 'fecha', type: 'date', isNullable: true },
        { name: 'soporte', type: 'text', isNullable: true },
        { name: 'justificacion', type: 'text', isNullable: false },
        { name: 'valor_anterior', type: 'bigint', isNullable: true },
        { name: 'valor_nuevo', type: 'bigint', isNullable: true },
        { name: 'nuevo_texto', type: 'text', isNullable: true },
        { name: 'fecha_anterior', type: 'date', isNullable: true },
        { name: 'fecha_nueva', type: 'date', isNullable: true },
        { name: 'impacto', type: 'text', isNullable: true },
        { name: 'estado', type: 'text', default: "'Activa'" },
        { name: 'motivo_anulacion', type: 'text', isNullable: true },
        ...FECHAS_FILA,
      ],
      foreignKeys: [fkContrato('modifications')],
    }));
    await creaIndice(qr, 'modifications', 'ix_modifications_contract', ['contract_id']);
    await creaIndice(qr, 'modifications', 'ix_modifications_estado', ['estado']);

    await qr.createTable(new Table({
      name: 'risks',
      columns: [
        ...comunes(),
        { name: 'contract_id', type: 'text', isNullable: false },
        { name: 'categoria', type: 'text', isNullable: true },
        { name: 'riesgo', type: 'text', isNullable: false },
        { name: 'prob', type: 'int', isNullable: false },
        { name: 'impacto', type: 'int', isNullable: false },
        { name: 'responsable', type: 'text', isNullable: true },
        { name: 'tratamiento', type: 'text', isNullable: true },
        { name: 'fecha', type: 'date', isNullable: true },
        { name: 'estado', type: 'text', default: "'Abierto'" },
        { name: 'mitigacion', type: 'text', isNullable: true },
        { name: 'evidencia', type: 'text', isNullable: true },
        { name: 'motivo_anulacion', type: 'text', isNullable: true },
        ...FECHAS_FILA,
      ],
      foreignKeys: [fkContrato('risks')],
    }));
    await creaIndice(qr, 'risks', 'ix_risks_contract', ['contract_id']);
    await creaIndice(qr, 'risks', 'ix_risks_estado', ['estado']);

    await qr.createTable(new Table({
      name: 'breaches',
      columns: [
        ...comunes(),
        { name: 'contract_id', type: 'text', isNullable: false },
        { name: 'fecha', type: 'date', isNullable: true },
        { name: 'obligation_id', type: 'text', isNullable: true },
        { name: 'tipo', type: 'text', isNullable: false },
        { name: 'descripcion', type: 'text', isNullable: false },
        { name: 'responsable', type: 'text', isNullable: true },
        { name: 'impacto', type: 'text', isNullable: true },
        { name: 'estado', type: 'text', default: "'Abierto'" },
        { name: 'plan', type: 'text', isNullable: true },
        { name: 'fecha_limite', type: 'date', isNullable: true },
        { name: 'medida', type: 'text', isNullable: true },
        { name: 'multa', type: 'bigint', isNullable: true },
        { name: 'evidencia', type: 'text', isNullable: true },
        { name: 'motivo_anulacion', type: 'text', isNullable: true },
        ...FECHAS_FILA,
      ],
      foreignKeys: [
        fkContrato('breaches'),
        new TableForeignKey({ name: 'fk_breaches_obligation', columnNames: ['obligation_id'], referencedTableName: 'obligations', referencedColumnNames: ['id'], onDelete: 'RESTRICT' }),
      ],
    }));
    await creaIndice(qr, 'breaches', 'ix_breaches_contract', ['contract_id']);
    await creaIndice(qr, 'breaches', 'ix_breaches_obligation', ['obligation_id']);
    await creaIndice(qr, 'breaches', 'ix_breaches_estado', ['estado']);

    await qr.createTable(new Table({
      name: 'plans',
      columns: [
        ...comunes(),
        { name: 'contract_id', type: 'text', isNullable: false },
        { name: 'fecha', type: 'date', isNullable: true },
        { name: 'hallazgo', type: 'text', isNullable: false },
        { name: 'causa', type: 'text', isNullable: true },
        { name: 'accion', type: 'text', isNullable: false },
        { name: 'responsable', type: 'text', isNullable: true },
        { name: 'estado', type: 'text', default: "'Abierto'" },
        { name: 'avance', type: 'numeric', precision: 5, scale: 2, isNullable: true },
        { name: 'evidencia', type: 'text', isNullable: true },
        { name: 'motivo_anulacion', type: 'text', isNullable: true },
        ...FECHAS_FILA,
      ],
      foreignKeys: [fkContrato('plans')],
    }));
    await creaIndice(qr, 'plans', 'ix_plans_contract', ['contract_id']);
    await creaIndice(qr, 'plans', 'ix_plans_estado', ['estado']);

    await qr.createTable(new Table({
      name: 'documents',
      columns: [
        ...comunes(),
        { name: 'contract_id', type: 'text', isNullable: false },
        { name: 'nombre', type: 'text', isNullable: false },
        { name: 'categoria', type: 'text', isNullable: false },
        { name: 'estado', type: 'text', default: "'Activo'" },
        { name: 'obs', type: 'text', isNullable: true },
        { name: 'extracted', type: 'jsonb', isNullable: true },
        { name: 'motivo_anulacion', type: 'text', isNullable: true },
        ...FECHAS_FILA,
      ],
      foreignKeys: [fkContrato('documents')],
    }));
    await creaIndice(qr, 'documents', 'ix_documents_contract', ['contract_id']);
    await creaIndice(qr, 'documents', 'ix_documents_categoria', ['categoria']);
    await creaIndice(qr, 'documents', 'ix_documents_estado', ['estado']);

    await qr.createTable(new Table({
      name: 'document_versions',
      columns: [
        { name: 'id', type: 'text', isPrimary: true },
        { name: 'document_id', type: 'text', isNullable: false },
        { name: 'v', type: 'int', isNullable: false },
        { name: 'fecha', type: 'text', isNullable: false },
        { name: 'usuario', type: 'text', isNullable: false },
        { name: 'archivo', type: 'text', isNullable: false },
        { name: 'motivo', type: 'text', isNullable: true },
        { name: 'cambios', type: 'text', isNullable: true },
        { name: 'created_at', type: 'timestamptz', default: 'now()' },
      ],
      foreignKeys: [new TableForeignKey({ name: 'fk_docversions_document', columnNames: ['document_id'], referencedTableName: 'documents', referencedColumnNames: ['id'], onDelete: 'CASCADE' })],
    }));
    await creaIndice(qr, 'document_versions', 'ux_docversions_doc_v', ['document_id', 'v'], true);

    // ── Sistema ────────────────────────────────────────────────────────────
    await qr.createTable(new Table({
      name: 'users',
      columns: [
        ...comunes(),
        { name: 'nombre', type: 'text', isNullable: false },
        { name: 'email', type: 'text', isNullable: false },
        { name: 'rol', type: 'text', isNullable: false },
        { name: 'estado', type: 'text', default: "'Activo'" },
        { name: 'motivo_anulacion', type: 'text', isNullable: true },
        ...FECHAS_FILA,
      ],
    }));
    await creaIndice(qr, 'users', 'ux_users_email', ['email'], true);

    await qr.createTable(new Table({
      name: 'role_permissions',
      columns: [
        { name: 'id', type: 'serial', isPrimary: true },
        { name: 'rol', type: 'text', isNullable: false },
        { name: 'permiso', type: 'text', isNullable: false },
        { name: 'habilitado', type: 'boolean', default: false },
      ],
    }));
    await creaIndice(qr, 'role_permissions', 'ux_role_permiso', ['rol', 'permiso'], true);

    await qr.createTable(new Table({
      name: 'settings',
      columns: [
        { name: 'id', type: 'int', isPrimary: true },
        { name: 'alert_days', type: 'jsonb', default: "'[30,15,10,5,3,1]'::jsonb" },
        { name: 'critical_days', type: 'int', default: 5 },
        { name: 'budget_pct', type: 'int', default: 15 },
        { name: 'gap_pct', type: 'int', default: 20 },
        { name: 'updated_at', type: 'timestamptz', default: 'now()' },
      ],
    }));

    await qr.createTable(new Table({
      name: 'catalogs',
      columns: [
        { name: 'nombre', type: 'text', isPrimary: true },
        { name: 'created_at', type: 'timestamptz', default: 'now()' },
        { name: 'updated_at', type: 'timestamptz', default: 'now()' },
      ],
    }));
    await qr.createTable(new Table({
      name: 'catalog_items',
      columns: [
        { name: 'id', type: 'serial', isPrimary: true },
        { name: 'catalog_nombre', type: 'text', isNullable: false },
        { name: 'valor', type: 'text', isNullable: false },
        { name: 'orden', type: 'int', default: 0 },
      ],
      foreignKeys: [new TableForeignKey({ name: 'fk_catalog_items_catalog', columnNames: ['catalog_nombre'], referencedTableName: 'catalogs', referencedColumnNames: ['nombre'], onDelete: 'CASCADE' })],
    }));
    await creaIndice(qr, 'catalog_items', 'ux_catalog_valor', ['catalog_nombre', 'valor'], true);

    await qr.createTable(new Table({
      name: 'alert_state',
      columns: [
        { name: 'alert_key', type: 'text', isPrimary: true },
        { name: 'estado', type: 'text', isNullable: false },
        { name: 'delegado_a', type: 'text', isNullable: true },
        { name: 'nota', type: 'text', isNullable: true },
        { name: 'usuario', type: 'text', isNullable: false },
        { name: 'fecha_gestion', type: 'timestamptz', isNullable: false },
      ],
    }));

    await qr.createTable(new Table({
      name: 'alert_keys',
      columns: [
        { name: 'alert_key', type: 'text', isPrimary: true },
        { name: 'tipo', type: 'text', isNullable: false },
        { name: 'contract_id', type: 'text', isNullable: true },
        { name: 'primera_vez', type: 'timestamptz', default: 'now()' },
      ],
    }));

    await qr.createTable(new Table({
      name: 'tasks',
      columns: [
        ...comunes(),
        { name: 'titulo', type: 'text', isNullable: false },
        { name: 'asignado', type: 'text', isNullable: false },
        { name: 'vence', type: 'date', isNullable: true },
        { name: 'contract_id', type: 'text', isNullable: true },
        { name: 'alert_key', type: 'text', isNullable: true },
        { name: 'estado', type: 'text', default: "'Abierta'" },
        { name: 'creada_por', type: 'text', isNullable: false },
        ...FECHAS_FILA,
      ],
    }));
    await creaIndice(qr, 'tasks', 'ix_tasks_estado', ['estado']);
    await creaIndice(qr, 'tasks', 'ix_tasks_alert', ['alert_key']);
    await creaIndice(qr, 'tasks', 'ix_tasks_contract', ['contract_id']);

    // ── Auditoría (INSERT-only) ────────────────────────────────────────────
    await qr.createTable(new Table({
      name: 'audit_log',
      columns: [
        { name: 'id', type: 'serial', isPrimary: true },
        { name: 'ts', type: 'timestamptz', isNullable: false },
        { name: 'fecha', type: 'text', isNullable: false },
        { name: 'hora', type: 'text', isNullable: false },
        { name: 'usuario', type: 'text', isNullable: false },
        { name: 'rol', type: 'text', isNullable: false },
        { name: 'contract_id', type: 'text', isNullable: true },
        { name: 'modulo', type: 'text', isNullable: false },
        { name: 'accion', type: 'text', isNullable: false },
        { name: 'campo', type: 'text', isNullable: true },
        { name: 'anterior', type: 'text', isNullable: true },
        { name: 'nuevo', type: 'text', isNullable: true },
        { name: 'ip', type: 'text', isNullable: true },
        { name: 'obs', type: 'text', isNullable: true },
        { name: 'hash', type: 'text', isNullable: false },
      ],
    }));
    await creaIndice(qr, 'audit_log', 'ix_audit_contract', ['contract_id']);
    await creaIndice(qr, 'audit_log', 'ix_audit_usuario', ['usuario']);
    await creaIndice(qr, 'audit_log', 'ix_audit_fecha', ['fecha']);
    await creaIndice(qr, 'audit_log', 'ix_audit_modulo', ['modulo']);
    await creaIndice(qr, 'audit_log', 'ix_audit_accion', ['accion']);

    // Trigger INSERT-only: bloquea UPDATE y DELETE a nivel de base de datos.
    await qr.query(`
      CREATE OR REPLACE FUNCTION audit_log_bloquear_cambios() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'audit_log es INSERT-only: se bloqueo %', TG_OP;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await qr.query(`
      CREATE TRIGGER trg_audit_log_insert_only
      BEFORE UPDATE OR DELETE ON audit_log
      FOR EACH ROW EXECUTE FUNCTION audit_log_bloquear_cambios();
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query('DROP TRIGGER IF EXISTS trg_audit_log_insert_only ON audit_log;');
    await qr.query('DROP FUNCTION IF EXISTS audit_log_bloquear_cambios();');
    const tablas = [
      'document_versions', 'documents', 'plans', 'breaches', 'risks', 'modifications', 'actas',
      'guarantees', 'payments', 'execs', 'deliverables', 'obligation_evidences', 'obligation_comments',
      'obligation_checklist', 'obligations', 'subcontracts', 'contracts', 'companies', 'cupos',
      'tasks', 'alert_keys', 'alert_state', 'audit_log', 'catalog_items', 'catalogs', 'settings',
      'role_permissions', 'users',
    ];
    for (const t of tablas) await qr.query(`DROP TABLE IF EXISTS ${t} CASCADE;`);
  }
}
