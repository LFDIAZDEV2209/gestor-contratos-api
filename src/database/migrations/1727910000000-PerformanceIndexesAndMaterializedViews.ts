import { MigrationInterface, QueryRunner } from 'typeorm';

export class PerformanceIndexesAndMaterializedViews1727910000000 implements MigrationInterface {
  name = 'PerformanceIndexesAndMaterializedViews1727910000000';

  async up(qr: QueryRunner): Promise<void> {
    // ═════════════════════════════════════════════════════════════════════════
    // 1. ÍNDICES DE RENDIMIENTO PARA PATRONES DE CONSULTA REALES
    // ═════════════════════════════════════════════════════════════════════════

    // Contratos: filtros compuestos de estado y empresa, fechas y búsqueda
    await qr.query(`
      CREATE INDEX IF NOT EXISTS ix_contracts_anulado_estado_company
      ON contracts (anulado, estado, company_id);
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS ix_contracts_deptos_gin
      ON contracts USING gin (deptos);
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS ix_contracts_fecha_firma
      ON contracts (fecha_firma);
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS ix_contracts_fecha_inicio
      ON contracts (fecha_inicio);
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS ix_contracts_contratista
      ON contracts (contratista);
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS ix_contracts_supervisor
      ON contracts (supervisor);
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS ix_contracts_responsable
      ON contracts (responsable);
    `);

    // Hijas del Contrato: ordenamiento por recencia en paginación (ChildCollectionsService)
    await qr.query(`
      CREATE INDEX IF NOT EXISTS ix_subcontracts_contract_created
      ON subcontracts (contract_id, created_at DESC);
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS ix_obligations_contract_created
      ON obligations (contract_id, created_at DESC);
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS ix_deliverables_contract_created
      ON deliverables (contract_id, created_at DESC);
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS ix_execs_contract_created
      ON execs (contract_id, created_at DESC);
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS ix_payments_contract_created
      ON payments (contract_id, created_at DESC);
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS ix_payments_estado_fecha
      ON payments (estado, fecha);
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS ix_guarantees_contract_created
      ON guarantees (contract_id, created_at DESC);
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS ix_guarantees_aseg_estado
      ON guarantees (aseguradora, estado);
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS ix_guarantees_modalidad
      ON guarantees (modalidad_poliza);
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS ix_cupos_aseg_estado
      ON cupos (aseguradora, estado);
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS ix_actas_contract_created
      ON actas (contract_id, created_at DESC);
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS ix_modifications_contract_created
      ON modifications (contract_id, created_at DESC);
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS ix_risks_contract_created
      ON risks (contract_id, created_at DESC);
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS ix_risks_categoria
      ON risks (categoria);
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS ix_risks_prob_impacto
      ON risks (prob, impacto);
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS ix_breaches_contract_created
      ON breaches (contract_id, created_at DESC);
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS ix_plans_contract_created
      ON plans (contract_id, created_at DESC);
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS ix_documents_contract_created
      ON documents (contract_id, created_at DESC);
    `);

    // Auditoría, Tareas y Colecciones Secundarias
    await qr.query(`
      CREATE INDEX IF NOT EXISTS ix_audit_contract_id_desc
      ON audit_log (contract_id, id DESC);
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS ix_audit_fecha_modulo
      ON audit_log (fecha, modulo);
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS ix_tasks_asignado_vence
      ON tasks (asignado, vence);
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS ix_alert_keys_contract_tipo
      ON alert_keys (contract_id, tipo);
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS ix_obchecklist_obligation_orden
      ON obligation_checklist (obligation_id, orden ASC);
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS ix_obcomments_obligation_created
      ON obligation_comments (obligation_id, created_at DESC);
    `);

    // ═════════════════════════════════════════════════════════════════════════
    // 2. MATERIALIZED VIEW 1: mv_geo_aggregates (Agregados Mapa Colombia)
    // ═════════════════════════════════════════════════════════════════════════
    await qr.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS mv_geo_aggregates AS
      WITH deptos_maestro(codigo_dane, nombre_depto, region) AS (
        VALUES
          ('05', 'Antioquia', 'Andina'),
          ('08', 'Atlántico', 'Caribe'),
          ('11', 'Bogotá, D.C.', 'Andina'),
          ('13', 'Bolívar', 'Caribe'),
          ('15', 'Boyacá', 'Andina'),
          ('17', 'Caldas', 'Andina'),
          ('18', 'Caquetá', 'Amazonía'),
          ('19', 'Cauca', 'Pacífica'),
          ('20', 'Cesar', 'Caribe'),
          ('23', 'Córdoba', 'Caribe'),
          ('25', 'Cundinamarca', 'Andina'),
          ('27', 'Chocó', 'Pacífica'),
          ('41', 'Huila', 'Andina'),
          ('44', 'La Guajira', 'Caribe'),
          ('47', 'Magdalena', 'Caribe'),
          ('50', 'Meta', 'Orinoquía'),
          ('52', 'Nariño', 'Pacífica'),
          ('54', 'Norte de Santander', 'Andina'),
          ('63', 'Quindío', 'Andina'),
          ('66', 'Risaralda', 'Andina'),
          ('68', 'Santander', 'Andina'),
          ('70', 'Sucre', 'Caribe'),
          ('73', 'Tolima', 'Andina'),
          ('76', 'Valle del Cauca', 'Pacífica'),
          ('81', 'Arauca', 'Orinoquía'),
          ('85', 'Casanare', 'Orinoquía'),
          ('86', 'Putumayo', 'Amazonía'),
          ('88', 'San Andrés, Providencia y Santa Catalina', 'Insular'),
          ('91', 'Amazonas', 'Amazonía'),
          ('94', 'Guainía', 'Amazonía'),
          ('95', 'Guaviare', 'Amazonía'),
          ('97', 'Vaupés', 'Amazonía'),
          ('99', 'Vichada', 'Orinoquía')
      ),
      contratos_expandidos AS (
        SELECT
          c.id AS contract_id,
          c.estado,
          c.nit_contratista,
          (c.valor_base + c.iva + c.otros_imp + c.adiciones - c.reducciones) AS valor_actual,
          depto_code.elem AS codigo_dane
        FROM contracts c
        CROSS JOIN LATERAL jsonb_array_elements_text(
          CASE 
            WHEN jsonb_typeof(c.deptos) = 'array' THEN c.deptos 
            ELSE '[]'::jsonb 
          END
        ) AS depto_code(elem)
        WHERE c.anulado = false
      ),
      garantias_por_contrato AS (
        SELECT
          g.contract_id,
          COUNT(*)::bigint AS polizas_count,
          COALESCE(SUM(g.valor), 0)::bigint AS valor_asegurado_sum
        FROM guarantees g
        WHERE g.estado != 'Anulada'
        GROUP BY g.contract_id
      ),
      agregados_depto AS (
        SELECT
          ce.codigo_dane,
          COUNT(DISTINCT ce.contract_id)::bigint AS contratos_total,
          COUNT(DISTINCT CASE WHEN ce.estado = 'Activo' THEN ce.contract_id END)::bigint AS contratos_activos,
          COUNT(DISTINCT CASE WHEN ce.estado = 'Suspendido' THEN ce.contract_id END)::bigint AS contratos_suspendidos,
          COUNT(DISTINCT CASE WHEN ce.estado = 'En liquidación' THEN ce.contract_id END)::bigint AS contratos_en_liquidacion,
          COUNT(DISTINCT CASE WHEN ce.estado = 'Liquidado' THEN ce.contract_id END)::bigint AS contratos_liquidados,
          COUNT(DISTINCT CASE WHEN ce.estado = 'Terminado' THEN ce.contract_id END)::bigint AS contratos_terminados,
          COALESCE(SUM(ce.valor_actual), 0)::bigint AS valor_contratado,
          COALESCE(SUM(gpc.polizas_count), 0)::bigint AS polizas_total,
          COALESCE(SUM(gpc.valor_asegurado_sum), 0)::bigint AS valor_asegurado,
          COUNT(DISTINCT ce.nit_contratista)::bigint AS clientes_unicos
        FROM contratos_expandidos ce
        LEFT JOIN garantias_por_contrato gpc ON gpc.contract_id = ce.contract_id
        GROUP BY ce.codigo_dane
      )
      SELECT
        dm.codigo_dane,
        dm.nombre_depto,
        dm.region,
        COALESCE(ad.contratos_total, 0)::bigint AS contratos_total,
        COALESCE(ad.contratos_activos, 0)::bigint AS contratos_activos,
        COALESCE(ad.contratos_suspendidos, 0)::bigint AS contratos_suspendidos,
        COALESCE(ad.contratos_en_liquidacion, 0)::bigint AS contratos_en_liquidacion,
        COALESCE(ad.contratos_liquidados, 0)::bigint AS contratos_liquidados,
        COALESCE(ad.contratos_terminados, 0)::bigint AS contratos_terminados,
        COALESCE(ad.valor_contratado, 0)::bigint AS valor_contratado,
        COALESCE(ad.polizas_total, 0)::bigint AS polizas_total,
        COALESCE(ad.valor_asegurado, 0)::bigint AS valor_asegurado,
        COALESCE(ad.clientes_unicos, 0)::bigint AS clientes_unicos,
        now() AS actualizado_en
      FROM deptos_maestro dm
      LEFT JOIN agregados_depto ad ON ad.codigo_dane = dm.codigo_dane
      WITH DATA;
    `);

    await qr.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_geo_aggregates_dane
      ON mv_geo_aggregates (codigo_dane);
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS ix_mv_geo_aggregates_region
      ON mv_geo_aggregates (region);
    `);

    // ═════════════════════════════════════════════════════════════════════════
    // 3. MATERIALIZED VIEW 2: mv_reports_summary (Resumen de Contratos y Reportes)
    // ═════════════════════════════════════════════════════════════════════════
    await qr.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS mv_reports_summary AS
      WITH
      agg_execs AS (
        SELECT contract_id, COALESCE(SUM(valor), 0)::bigint AS ejecutado
        FROM execs WHERE motivo_anulacion IS NULL GROUP BY contract_id
      ),
      agg_pagos AS (
        SELECT contract_id, COALESCE(SUM(bruto + COALESCE(iva, 0)), 0)::bigint AS pagado
        FROM payments WHERE estado = 'Pagado' AND motivo_anulacion IS NULL GROUP BY contract_id
      ),
      agg_subs AS (
        SELECT contract_id, COUNT(*)::bigint AS total_subcontratos, COALESCE(SUM(valor), 0)::bigint AS valor_subcontratos
        FROM subcontracts WHERE motivo_anulacion IS NULL GROUP BY contract_id
      ),
      agg_obls AS (
        SELECT contract_id, COUNT(*)::bigint AS total_obligaciones,
               COUNT(CASE WHEN estado = 'Cumplida' THEN 1 END)::bigint AS obligaciones_cumplidas
        FROM obligations WHERE motivo_anulacion IS NULL GROUP BY contract_id
      ),
      agg_dels AS (
        SELECT contract_id, COUNT(*)::bigint AS total_entregables,
               COUNT(CASE WHEN estado IN ('Recibido', 'Aprobado') THEN 1 END)::bigint AS entregables_recibidos
        FROM deliverables WHERE motivo_anulacion IS NULL GROUP BY contract_id
      ),
      agg_gars AS (
        SELECT contract_id, COUNT(*)::bigint AS total_garantias, COALESCE(SUM(valor), 0)::bigint AS valor_asegurado
        FROM guarantees WHERE estado != 'Anulada' GROUP BY contract_id
      ),
      agg_mods AS (
        SELECT contract_id, COUNT(*)::bigint AS total_modificaciones
        FROM modifications WHERE motivo_anulacion IS NULL GROUP BY contract_id
      ),
      agg_risks AS (
        SELECT contract_id, COUNT(*)::bigint AS total_riesgos,
               COUNT(CASE WHEN (prob * impacto) >= 15 THEN 1 END)::bigint AS riesgos_extremos,
               COUNT(CASE WHEN (prob * impacto) BETWEEN 10 AND 14 THEN 1 END)::bigint AS riesgos_altos
        FROM risks WHERE motivo_anulacion IS NULL GROUP BY contract_id
      ),
      agg_breaches AS (
        SELECT contract_id, COUNT(*)::bigint AS total_incumplimientos, COALESCE(SUM(multa), 0)::bigint AS multas_total
        FROM breaches WHERE motivo_anulacion IS NULL GROUP BY contract_id
      )
      SELECT
        c.id AS contract_id,
        c.numero,
        c.company_id,
        comp.razon AS company_razon,
        comp.nit AS company_nit,
        c.tipo,
        c.modalidad,
        c.estado,
        c.contratista,
        c.nit_contratista,
        c.responsable,
        c.supervisor,
        c.fecha_firma,
        c.fecha_inicio,
        c.fecha_fin,
        EXTRACT(YEAR FROM c.fecha_firma)::int AS anio_firma,
        c.valor_base,
        c.iva,
        c.otros_imp,
        c.adiciones,
        c.reducciones,
        (c.valor_base + c.iva + c.otros_imp + c.adiciones - c.reducciones)::bigint AS valor_actual,
        COALESCE(ae.ejecutado, 0)::bigint AS ejecutado,
        COALESCE(ap.pagado, 0)::bigint AS pagado,
        ((c.valor_base + c.iva + c.otros_imp + c.adiciones - c.reducciones) - COALESCE(ae.ejecutado, 0))::bigint AS saldo,
        CASE
          WHEN (c.valor_base + c.iva + c.otros_imp + c.adiciones - c.reducciones) > 0
          THEN ROUND((COALESCE(ae.ejecutado, 0)::numeric / (c.valor_base + c.iva + c.otros_imp + c.adiciones - c.reducciones)::numeric) * 100, 2)
          ELSE 0
        END AS pct_ejecucion_fin,
        COALESCE(c.avance_fisico, 0)::numeric(5,2) AS avance_fisico,
        COALESCE(asb.total_subcontratos, 0)::bigint AS total_subcontratos,
        COALESCE(asb.valor_subcontratos, 0)::bigint AS valor_subcontratos,
        COALESCE(ao.total_obligaciones, 0)::bigint AS total_obligaciones,
        COALESCE(ao.obligaciones_cumplidas, 0)::bigint AS obligaciones_cumplidas,
        COALESCE(ad.total_entregables, 0)::bigint AS total_entregables,
        COALESCE(ad.entregables_recibidos, 0)::bigint AS entregables_recibidos,
        COALESCE(ag.total_garantias, 0)::bigint AS total_garantias,
        COALESCE(ag.valor_asegurado, 0)::bigint AS valor_asegurado,
        COALESCE(am.total_modificaciones, 0)::bigint AS total_modificaciones,
        COALESCE(ar.total_riesgos, 0)::bigint AS total_riesgos,
        COALESCE(ar.riesgos_extremos, 0)::bigint AS riesgos_extremos,
        COALESCE(ar.riesgos_altos, 0)::bigint AS riesgos_altos,
        COALESCE(ab.total_incumplimientos, 0)::bigint AS total_incumplimientos,
        COALESCE(ab.multas_total, 0)::bigint AS multas_total,
        now() AS actualizado_en
      FROM contracts c
      JOIN companies comp ON comp.id = c.company_id
      LEFT JOIN agg_execs ae ON ae.contract_id = c.id
      LEFT JOIN agg_pagos ap ON ap.contract_id = c.id
      LEFT JOIN agg_subs asb ON asb.contract_id = c.id
      LEFT JOIN agg_obls ao ON ao.contract_id = c.id
      LEFT JOIN agg_dels ad ON ad.contract_id = c.id
      LEFT JOIN agg_gars ag ON ag.contract_id = c.id
      LEFT JOIN agg_mods am ON am.contract_id = c.id
      LEFT JOIN agg_risks ar ON ar.contract_id = c.id
      LEFT JOIN agg_breaches ab ON ab.contract_id = c.id
      WHERE c.anulado = false
      WITH DATA;
    `);

    await qr.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_reports_summary_contract
      ON mv_reports_summary (contract_id);
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS ix_mv_reports_summary_company
      ON mv_reports_summary (company_id);
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS ix_mv_reports_summary_estado
      ON mv_reports_summary (estado);
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS ix_mv_reports_summary_anio
      ON mv_reports_summary (anio_firma);
    `);

    // ═════════════════════════════════════════════════════════════════════════
    // 4. MATERIALIZED VIEW 3: mv_dashboard_kpis (KPIs de Panel Principal)
    // ═════════════════════════════════════════════════════════════════════════
    await qr.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dashboard_kpis AS
      WITH
      contratos_base AS (
        SELECT
          c.id AS contract_id,
          c.company_id,
          c.estado,
          c.fecha_fin,
          c.avance_fisico,
          (c.valor_base + c.iva + c.otros_imp + c.adiciones - c.reducciones)::bigint AS valor_actual,
          CASE
            WHEN c.estado = 'Activo' AND c.fecha_fin IS NOT NULL AND c.fecha_fin < CURRENT_DATE THEN 'Vencido'
            ELSE c.estado
          END AS estado_efectivo
        FROM contracts c
        WHERE c.anulado = false
      ),
      contrato_metricas AS (
        SELECT
          cb.*,
          COALESCE(SUM(e.valor), 0)::bigint AS ejecutado,
          COALESCE(p.pagado, 0)::bigint AS pagado
        FROM contratos_base cb
        LEFT JOIN execs e ON e.contract_id = cb.contract_id AND e.motivo_anulacion IS NULL
        LEFT JOIN (
          SELECT contract_id, SUM(bruto + COALESCE(iva, 0))::bigint AS pagado
          FROM payments WHERE estado = 'Pagado' AND motivo_anulacion IS NULL
          GROUP BY contract_id
        ) p ON p.contract_id = cb.contract_id
        GROUP BY cb.contract_id, cb.company_id, cb.estado, cb.fecha_fin, cb.avance_fisico, cb.valor_actual, cb.estado_efectivo, p.pagado
      ),
      garantias_base AS (
        SELECT
          g.contract_id,
          c.company_id,
          g.valor,
          g.fecha_venc,
          g.estado
        FROM guarantees g
        JOIN contracts c ON c.id = g.contract_id
        WHERE g.estado != 'Anulada' AND c.anulado = false
      ),
      riesgos_base AS (
        SELECT r.contract_id, c.company_id, r.prob * r.impacto AS score
        FROM risks r
        JOIN contracts c ON c.id = r.contract_id
        WHERE r.estado = 'Abierto' AND r.motivo_anulacion IS NULL AND c.anulado = false
      ),
      incumplimientos_base AS (
        SELECT b.contract_id, c.company_id
        FROM breaches b
        JOIN contracts c ON c.id = b.contract_id
        WHERE b.estado = 'Abierto' AND b.motivo_anulacion IS NULL AND c.anulado = false
      ),
      scopes AS (
        SELECT 'GLOBAL' AS scope, NULL::text AS company_id
        UNION ALL
        SELECT id AS scope, id AS company_id FROM companies
      )
      SELECT
        s.scope,
        s.company_id,
        COALESCE(COUNT(cm.contract_id), 0)::bigint AS total_contratos,
        COALESCE(COUNT(CASE WHEN cm.estado_efectivo = 'Activo' THEN 1 END), 0)::bigint AS contratos_activos,
        COALESCE(COUNT(CASE WHEN cm.estado_efectivo = 'Vencido' THEN 1 END), 0)::bigint AS contratos_vencidos,
        COALESCE(COUNT(CASE WHEN cm.estado_efectivo = 'Suspendido' THEN 1 END), 0)::bigint AS contratos_suspendidos,
        COALESCE(COUNT(CASE WHEN cm.estado_efectivo = 'En liquidación' THEN 1 END), 0)::bigint AS contratos_en_liquidacion,
        COALESCE(COUNT(CASE WHEN cm.estado_efectivo = 'Liquidado' THEN 1 END), 0)::bigint AS contratos_liquidados,
        COALESCE(COUNT(CASE WHEN cm.estado_efectivo = 'Terminado' THEN 1 END), 0)::bigint AS contratos_terminados,
        COALESCE(SUM(cm.valor_actual), 0)::bigint AS valor_total_contratado,
        COALESCE(SUM(cm.ejecutado), 0)::bigint AS valor_total_ejecutado,
        COALESCE(SUM(cm.pagado), 0)::bigint AS valor_total_pagado,
        COALESCE(SUM(cm.valor_actual - cm.ejecutado), 0)::bigint AS saldo_total,
        CASE
          WHEN SUM(cm.valor_actual) > 0 THEN ROUND((SUM(cm.ejecutado)::numeric / SUM(cm.valor_actual)::numeric) * 100, 2)
          ELSE 0
        END AS pct_ejecucion_fin,
        COALESCE(ROUND(AVG(cm.avance_fisico), 2), 0) AS promedio_avance_fisico,
        COALESCE((
          SELECT COUNT(*)::bigint FROM garantias_base gb
          WHERE s.company_id IS NULL OR gb.company_id = s.company_id
        ), 0)::bigint AS total_polizas,
        COALESCE((
          SELECT SUM(gb.valor)::bigint FROM garantias_base gb
          WHERE s.company_id IS NULL OR gb.company_id = s.company_id
        ), 0)::bigint AS valor_asegurado_total,
        COALESCE((
          SELECT COUNT(*)::bigint FROM garantias_base gb
          WHERE (s.company_id IS NULL OR gb.company_id = s.company_id)
            AND gb.fecha_venc < CURRENT_DATE
        ), 0)::bigint AS polizas_vencidas,
        COALESCE((
          SELECT COUNT(*)::bigint FROM garantias_base gb
          WHERE (s.company_id IS NULL OR gb.company_id = s.company_id)
            AND gb.fecha_venc >= CURRENT_DATE AND gb.fecha_venc <= (CURRENT_DATE + INTERVAL '30 days')
        ), 0)::bigint AS polizas_proximas_vencer,
        COALESCE((
          SELECT COUNT(*)::bigint FROM riesgos_base rb
          WHERE (s.company_id IS NULL OR rb.company_id = s.company_id) AND rb.score >= 15
        ), 0)::bigint AS total_riesgos_criticos,
        COALESCE((
          SELECT COUNT(*)::bigint FROM incumplimientos_base ib
          WHERE s.company_id IS NULL OR ib.company_id = s.company_id
        ), 0)::bigint AS total_incumplimientos_abiertos,
        now() AS actualizado_en
      FROM scopes s
      LEFT JOIN contrato_metricas cm ON s.company_id IS NULL OR cm.company_id = s.company_id
      GROUP BY s.scope, s.company_id
      WITH DATA;
    `);

    await qr.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_dashboard_kpis_scope
      ON mv_dashboard_kpis (scope);
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS ix_mv_dashboard_kpis_company
      ON mv_dashboard_kpis (company_id);
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    // 1. Eliminar Materialized Views y sus índices
    await qr.query('DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_kpis CASCADE;');
    await qr.query('DROP MATERIALIZED VIEW IF EXISTS mv_reports_summary CASCADE;');
    await qr.query('DROP MATERIALIZED VIEW IF EXISTS mv_geo_aggregates CASCADE;');

    // 2. Eliminar índices adicionales
    await qr.query('DROP INDEX IF EXISTS ix_obcomments_obligation_created;');
    await qr.query('DROP INDEX IF EXISTS ix_obchecklist_obligation_orden;');
    await qr.query('DROP INDEX IF EXISTS ix_alert_keys_contract_tipo;');
    await qr.query('DROP INDEX IF EXISTS ix_tasks_asignado_vence;');
    await qr.query('DROP INDEX IF EXISTS ix_audit_fecha_modulo;');
    await qr.query('DROP INDEX IF EXISTS ix_audit_contract_id_desc;');
    await qr.query('DROP INDEX IF EXISTS ix_documents_contract_created;');
    await qr.query('DROP INDEX IF EXISTS ix_plans_contract_created;');
    await qr.query('DROP INDEX IF EXISTS ix_breaches_contract_created;');
    await qr.query('DROP INDEX IF EXISTS ix_risks_prob_impacto;');
    await qr.query('DROP INDEX IF EXISTS ix_risks_categoria;');
    await qr.query('DROP INDEX IF EXISTS ix_risks_contract_created;');
    await qr.query('DROP INDEX IF EXISTS ix_modifications_contract_created;');
    await qr.query('DROP INDEX IF EXISTS ix_actas_contract_created;');
    await qr.query('DROP INDEX IF EXISTS ix_cupos_aseg_estado;');
    await qr.query('DROP INDEX IF EXISTS ix_guarantees_modalidad;');
    await qr.query('DROP INDEX IF EXISTS ix_guarantees_aseg_estado;');
    await qr.query('DROP INDEX IF EXISTS ix_guarantees_contract_created;');
    await qr.query('DROP INDEX IF EXISTS ix_payments_estado_fecha;');
    await qr.query('DROP INDEX IF EXISTS ix_payments_contract_created;');
    await qr.query('DROP INDEX IF EXISTS ix_execs_contract_created;');
    await qr.query('DROP INDEX IF EXISTS ix_deliverables_contract_created;');
    await qr.query('DROP INDEX IF EXISTS ix_obligations_contract_created;');
    await qr.query('DROP INDEX IF EXISTS ix_subcontracts_contract_created;');
    await qr.query('DROP INDEX IF EXISTS ix_contracts_responsable;');
    await qr.query('DROP INDEX IF EXISTS ix_contracts_supervisor;');
    await qr.query('DROP INDEX IF EXISTS ix_contracts_contratista;');
    await qr.query('DROP INDEX IF EXISTS ix_contracts_fecha_inicio;');
    await qr.query('DROP INDEX IF EXISTS ix_contracts_fecha_firma;');
    await qr.query('DROP INDEX IF EXISTS ix_contracts_deptos_gin;');
    await qr.query('DROP INDEX IF EXISTS ix_contracts_anulado_estado_company;');
  }
}
