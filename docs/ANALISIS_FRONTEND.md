# Análisis funcional exhaustivo del frontend — Nexo / Gestor Integral de Contratos

Fecha de análisis: 2026-10-05. Frontend: `gestor-contratos-front`; backend: `gestor-contratos-api`.

## Alcance, evidencia y convenciones

Análisis estático del working tree: **74 páginas de ruta** (73 bajo `app/(app)` y `app/login`), **17 pestañas del expediente**, **6 pestañas de configuración**, **19 reportes** y **32 componentes de formularios** (16 globales y 16 del expediente). Las 19 claves concretas expanden una sola ruta dinámica; no se suman al número de páginas. El mapa está dentro de /dashboard: no existe página /geo o /mapa en este inventario.

Se leyeron README completo del backend, páginas, componentes de vistas, pestañas, formularios, catálogo de reportes, todos los archivos de lib, controladores/servicios/DTO/entidades y motores relevantes. Referencia de HEAD: front `f5429c91b7951a5583290d3c5ec7b1413703a778`, API `bfc77a0e80daadcce13fe4b68f1ed06e2a5ad02c`. Había cambios de otros trabajos en el working tree y aparecieron más durante la lectura; este documento refleja el código leído y no supone un snapshot Git inmutable. No se modificó código ni se ejecutaron pruebas, migraciones, seed o llamadas de escritura a la API. Cobertura por código no certifica funcionamiento en producción.

Estados usados en cada apartado:

- **[CONFIRMADO por frontend]**: comportamiento, campo, acción o cálculo observable en el código del front; no implica que la regla esté aprobada por negocio.
- **[INFERIDO razonable]**: contrato HTTP, asociación física o recomendación técnica inferida; la presencia de una ruta en backend se indica expresamente como “existente en código”.
- **[REQUIERE VALIDACION DE NEGOCIO]**: decisión pendiente o comportamiento contradictorio que debe resolver el responsable funcional.

En la matriz, **Tablas** significa tablas PostgreSQL existentes, no tablas visuales; las columnas visibles se detallan en 2.3 y 4. Los endpoints llevan base `/api`. “Esperado” expresa necesidad del front, sin inventar una ruta como existente. **Cache**: todas las vistas de negocio comparten Store en memoria + `localStorage(gic_store_v2)`; M(c) usa `MCACHE` por ID; existe `clearMetricsCache`, pero no se localizaron llamadas de invalidación en app/components/lib salvo su definición. El frontend no integra caché HTTP. El backend incorporó concurrentemente CacheModule memoria/Valkey, wrappers de settings/geo/reportes y tres MV declaradas: sección 7.3. Implementación en código no acredita despliegue. Las recomendaciones son [INFERIDO razonable]. El estado de sesión local/sessionStorage no es prueba de autenticación.

## 1. Inventario de vistas: ruta y propósito

| # | Ruta | Propósito | Componente / fuente | Estado |
|---|---|---|---|---|
| 1 | `/actas/nueva` | Crear / registrar Acta | `@/components/forms/ActaForm` | [CONFIRMADO por frontend] |
| 2 | `/actas` | Actas contractuales, soportes y estado de firma | `@/components/views/ActasView` | [CONFIRMADO por frontend] |
| 3 | `/agenda` | Agenda de vencimientos por ventanas temporales | `@/components/views/AgendaView` | [CONFIRMADO por frontend] |
| 4 | `/alertas` | Centro de alertas calculadas y tareas de seguimiento | `@/components/views/AlertasView` | [CONFIRMADO por frontend] |
| 5 | `/alertas/tareas/nueva` | Crear / registrar Tarea | `@/components/forms/TareaForm` | [CONFIRMADO por frontend] |
| 6 | `/aseguradoras/cupos/nuevo` | Crear / registrar Cupo | `@/components/forms/CupoForm` | [CONFIRMADO por frontend] |
| 7 | `/aseguradoras` | Resumen de aseguradoras, matriz de cobertura y cupos | `@/components/views/AseguradorasView` | [CONFIRMADO por frontend] |
| 8 | `/auditoria` | Bitácora global, tabla y cronología con filtros | `@/components/views/AuditoriaView` | [CONFIRMADO por frontend] |
| 9 | `/calendario` | Calendario de eventos en modo mes, semana y día | `@/components/views/CalendarioView` | [CONFIRMADO por frontend] |
| 10 | `/configuracion` | Parámetros, catálogos, usuarios, roles, empresas y respaldo demo | `@/components/views/ConfiguracionView` | [CONFIRMADO por frontend] |
| 11 | `/configuracion/usuarios/nuevo` | Crear / registrar Usuario | `@/components/forms/UsuarioForm` | [CONFIRMADO por frontend] |
| 12 | `/configuracion/usuarios/[userId]/editar` | Editar Usuario | `@/components/forms/UsuarioForm` | [CONFIRMADO por frontend] |
| 13 | `/contrato/[id]/actas/nueva` | Crear / registrar Acta dentro del expediente | `@/components/expediente/forms/ActaForm` | [CONFIRMADO por frontend] |
| 14 | `/contrato/[id]/conciliacion` | Conciliar datos registrados con documento contractual | `@/components/expediente/ConciliacionView` | [CONFIRMADO por frontend] |
| 15 | `/contrato/[id]/documentos/nueva` | Crear / registrar Documento dentro del expediente | `@/components/expediente/forms/DocumentoForm` | [CONFIRMADO por frontend] |
| 16 | `/contrato/[id]/editar` | Editar Contrato dentro del expediente | `@/components/forms/ContratoForm` | [CONFIRMADO por frontend] |
| 17 | `/contrato/[id]/ejecucion/nueva` | Crear / registrar Ejecucion dentro del expediente | `@/components/expediente/forms/EjecucionForm` | [CONFIRMADO por frontend] |
| 18 | `/contrato/[id]/ejecucion/[executionId]/editar` | Editar Ejecucion dentro del expediente | `@/components/expediente/forms/EjecucionForm` | [CONFIRMADO por frontend] |
| 19 | `/contrato/[id]/entregables/nueva` | Crear / registrar Entregable dentro del expediente | `@/components/expediente/forms/EntregableForm` | [CONFIRMADO por frontend] |
| 20 | `/contrato/[id]/entregables/[deliverableId]/editar` | Editar Entregable dentro del expediente | `@/components/expediente/forms/EntregableForm` | [CONFIRMADO por frontend] |
| 21 | `/contrato/[id]/entregables/[deliverableId]/entrega/editar` | Editar Entrega dentro del expediente | `@/components/expediente/forms/EntregaForm` | [CONFIRMADO por frontend] |
| 22 | `/contrato/[id]/garantias/nueva` | Crear / registrar Garantia dentro del expediente | `@/components/expediente/forms/GarantiaForm` | [CONFIRMADO por frontend] |
| 23 | `/contrato/[id]/incumplimientos/nueva` | Crear / registrar Incumplimiento dentro del expediente | `@/components/expediente/forms/IncumplimientoForm` | [CONFIRMADO por frontend] |
| 24 | `/contrato/[id]/incumplimientos/[breachId]/editar` | Editar Incumplimiento dentro del expediente | `@/components/expediente/forms/IncumplimientoForm` | [CONFIRMADO por frontend] |
| 25 | `/contrato/[id]/modificaciones/nueva` | Crear / registrar Modificacion dentro del expediente | `@/components/expediente/forms/ModificacionForm` | [CONFIRMADO por frontend] |
| 26 | `/contrato/[id]/obligaciones/nueva` | Crear / registrar Obligacion dentro del expediente | `@/components/expediente/forms/ObligacionForm` | [CONFIRMADO por frontend] |
| 27 | `/contrato/[id]` | Expediente contractual con 17 pestañas y actuaciones | `@/components/views/ExpedienteView` | [CONFIRMADO por frontend] |
| 28 | `/contrato/[id]/pagos/nueva` | Crear / registrar Pago dentro del expediente | `@/components/expediente/forms/PagoForm` | [CONFIRMADO por frontend] |
| 29 | `/contrato/[id]/planes/nueva` | Crear / registrar Plan dentro del expediente | `@/components/expediente/forms/PlanForm` | [CONFIRMADO por frontend] |
| 30 | `/contrato/[id]/planes/[planId]/editar` | Editar Plan dentro del expediente | `@/components/expediente/forms/PlanForm` | [CONFIRMADO por frontend] |
| 31 | `/contrato/[id]/prorrogas/nueva` | Crear / registrar Prorroga dentro del expediente | `@/components/expediente/forms/ProrrogaForm` | [CONFIRMADO por frontend] |
| 32 | `/contrato/[id]/reinicios/nueva` | Crear / registrar Reinicio dentro del expediente | `@/components/expediente/forms/ReinicioForm` | [CONFIRMADO por frontend] |
| 33 | `/contrato/[id]/riesgos/nueva` | Crear / registrar Riesgo dentro del expediente | `@/components/expediente/forms/RiesgoForm` | [CONFIRMADO por frontend] |
| 34 | `/contrato/[id]/riesgos/[riskId]/editar` | Editar Riesgo dentro del expediente | `@/components/expediente/forms/RiesgoForm` | [CONFIRMADO por frontend] |
| 35 | `/contrato/[id]/subcontratos/nueva` | Crear / registrar Subcontrato dentro del expediente | `@/components/expediente/forms/SubcontratoForm` | [CONFIRMADO por frontend] |
| 36 | `/contrato/[id]/subcontratos/[subcontractId]/editar` | Editar Subcontrato dentro del expediente | `@/components/expediente/forms/SubcontratoForm` | [CONFIRMADO por frontend] |
| 37 | `/contrato/[id]/suspensiones/nueva` | Crear / registrar Suspension dentro del expediente | `@/components/expediente/forms/SuspensionForm` | [CONFIRMADO por frontend] |
| 38 | `/contrato/[id]/validacion` | Validar consistencia en 13 áreas del expediente | `@/components/expediente/ValidacionView` | [CONFIRMADO por frontend] |
| 39 | `/contratos/nuevo` | Crear / registrar Contrato | `@/components/forms/ContratoForm` | [CONFIRMADO por frontend] |
| 40 | `/contratos` | Portafolio con filtros, semáforo, indicadores y exportación | `@/components/views/ContratosView` | [CONFIRMADO por frontend] |
| 41 | `/dashboard` | Dashboard operativo, 14 KPIs, 8 gráficas, mapa y pendientes | `@/components/views/DashboardView` | [CONFIRMADO por frontend] |
| 42 | `/documentos/nuevo` | Crear / registrar Documento | `@/components/forms/DocumentoForm` | [CONFIRMADO por frontend] |
| 43 | `/documentos` | Repositorio documental global, ficha y versiones | `@/components/views/DocumentosView` | [CONFIRMADO por frontend] |
| 44 | `/documentos/[documentId]` | Repositorio documental global, ficha y versiones | `app/(app)/documentos/[documentId]/page.tsx` | [CONFIRMADO por frontend] |
| 45 | `/documentos/[documentId]/versiones/nueva` | Agregar versión de VersionDocumento | `@/components/forms/VersionDocumentoForm` | [CONFIRMADO por frontend] |
| 46 | `/ejecucion/nueva` | Crear / registrar Ejecucion | `@/components/forms/EjecucionForm` | [CONFIRMADO por frontend] |
| 47 | `/ejecucion` | Consolidado de ejecución y reportes mensuales | `@/components/views/EjecucionView` | [CONFIRMADO por frontend] |
| 48 | `/empresas/nueva` | Crear / registrar Empresa | `@/components/forms/EmpresaForm` | [CONFIRMADO por frontend] |
| 49 | `/empresas` | Directorio de empresas contratantes y ficha institucional | `@/components/views/EmpresasView` | [CONFIRMADO por frontend] |
| 50 | `/empresas/[id]/editar` | Editar Empresa | `@/components/forms/EmpresaForm` | [CONFIRMADO por frontend] |
| 51 | `/empresas/[id]` | Directorio de empresas contratantes y ficha institucional | `@/components/views/EmpresaView` | [CONFIRMADO por frontend] |
| 52 | `/garantias/nueva` | Crear / registrar Garantia | `@/components/forms/GarantiaForm` | [CONFIRMADO por frontend] |
| 53 | `/garantias` | Pólizas, amparos, vigencias, modalidad y aprobación | `@/components/views/GarantiasView` | [CONFIRMADO por frontend] |
| 54 | `/gerencia` | Control gerencial con 8 KPIs, 3 gráficas y contratos críticos | `@/components/views/GerenciaView` | [CONFIRMADO por frontend] |
| 55 | `/incumplimientos/nuevo` | Crear / registrar Incumplimiento | `@/components/forms/IncumplimientoForm` | [CONFIRMADO por frontend] |
| 56 | `/incumplimientos` | Incumplimientos, multas y planes de mejoramiento | `@/components/views/IncumplimientosView` | [CONFIRMADO por frontend] |
| 57 | `/incumplimientos/planes/nuevo` | Crear / registrar Plan | `@/components/forms/PlanForm` | [CONFIRMADO por frontend] |
| 58 | `/incumplimientos/planes/[planId]/editar` | Editar Plan | `@/components/forms/PlanForm` | [CONFIRMADO por frontend] |
| 59 | `/incumplimientos/[breachId]/editar` | Editar Incumplimiento | `@/components/forms/IncumplimientoForm` | [CONFIRMADO por frontend] |
| 60 | `/modificaciones/nueva` | Crear / registrar Modificacion | `@/components/forms/ModificacionForm` | [CONFIRMADO por frontend] |
| 61 | `/modificaciones` | Historial de cambios con efectos económicos, plazo y sujetos | `@/components/views/ModificacionesView` | [CONFIRMADO por frontend] |
| 62 | `/obligaciones` | Obligaciones, ficha, seguimiento y aprobación de cumplimiento | `@/components/views/ObligacionesView` | [CONFIRMADO por frontend] |
| 63 | `/obligaciones/[id]` | Obligaciones, ficha, seguimiento y aprobación de cumplimiento | `@/components/views/ObligacionFicha` | [CONFIRMADO por frontend] |
| 64 | `/pagos/nuevo` | Crear / registrar Pago | `@/components/forms/PagoForm` | [CONFIRMADO por frontend] |
| 65 | `/pagos` | Pagos, facturas, impuestos, aprobaciones y desembolsos | `@/components/views/PagosView` | [CONFIRMADO por frontend] |
| 66 | `/reportes` | Catálogo de 19 reportes, consulta, Excel/PDF/CSV/impresión | `@/components/views/ReportesView` | [CONFIRMADO por frontend] |
| 67 | `/reportes/[reportKey]` | Catálogo de 19 reportes, consulta, Excel/PDF/CSV/impresión | `app/(app)/reportes/[reportKey]/page.tsx` | [CONFIRMADO por frontend] |
| 68 | `/riesgos/nuevo` | Crear / registrar Riesgo | `@/components/forms/RiesgoForm` | [CONFIRMADO por frontend] |
| 69 | `/riesgos` | Matriz 5×5, categorías, niveles y mitigación | `@/components/views/RiesgosView` | [CONFIRMADO por frontend] |
| 70 | `/riesgos/[riskId]/editar` | Editar Riesgo | `@/components/forms/RiesgoForm` | [CONFIRMADO por frontend] |
| 71 | `/subcontratos/nuevo` | Crear / registrar Subcontrato | `@/components/forms/SubcontratoForm` | [CONFIRMADO por frontend] |
| 72 | `/subcontratos` | Subcontratación en tabla y árbol empresa/contrato | `@/components/views/SubcontratosView` | [CONFIRMADO por frontend] |
| 73 | `/subcontratos/[id]/editar` | Editar Subcontrato | `@/components/forms/SubcontratoForm` | [CONFIRMADO por frontend] |
| 74 | `/login` | Inicio de sesión corporativo demo y selección de usuario | `app/login/page.tsx` | [CONFIRMADO por frontend] |

## 2. Matriz funcional por vista

### 2.1 Matriz de las 74 páginas

La funcionalidad y los permisos indicados son los observados en el front. Endpoints/tablas se clasifican como [INFERIDO razonable] porque son el mapeo propuesto a la API, aunque se verifique su existencia en código. Los riesgos que requieren decisión son [REQUIERE VALIDACION DE NEGOCIO]. Lectura de listados exige VER en la API; algunas páginas del front no tienen guard específico, por lo que “sesión; VER servidor” no afirma un control frontend inexistente. El detalle de filtros/columnas/acciones y sus discrepancias aparece en 2.3, 5 y 7.

| Vista | Funcionalidad | Entidades | Endpoints esperados | Permisos | Tablas | Cache | Riesgos | Estado |
|---|---|---|---|---|---|---|---|---|
| `/actas/nueva` | Crear actas | Acta, Contract | POST /actas (existente) | crear | actas, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Estados Borrador/En firmas y firmantes no coinciden íntegramente con el DTO; anulación global usa editar. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/actas` | Actas contractuales, soportes y estado de firma | Acta, Contract | GET /actas (existente) | sesión; VER servidor | actas, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Estados Borrador/En firmas y firmantes no coinciden íntegramente con el DTO; anulación global usa editar. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/agenda` | Agenda de vencimientos por ventanas temporales | Contract, CMetrics | GET /contracts y métricas asociadas existentes; agregado de vencimientos agenda AUSENTE | sesión; VER servidor | contracts y colecciones para métricas | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | No hay endpoint de agenda; agregar sin limitar a una página. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/alertas` | Centro de alertas calculadas y tareas de seguimiento | Alert, AlertState, Task, User | GET /alerts (existente); POST /alerts/:key/read\|resolve\|delegate\|tasks; PUT /tasks/:id | sesión; VER servidor | alert_state, alert_keys, tasks, users y dominio contractual | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Claves y niveles diferentes; asignados por nombre en front e ID en API; tarea no marca alerta leída en API. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/alertas/tareas/nueva` | Resolver alerta por alertKey y crear compromiso asignado con vencimiento | Alert, AlertState, Task, User | GET /alerts; POST /alerts/:key/tasks; GET /tasks (existentes) | crear | alert_state, alert_keys, tasks, users y dominio contractual | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Claves y niveles diferentes; asignados por nombre en front e ID en API; tarea no marca alerta leída en API. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/aseguradoras/cupos/nuevo` | Crear quotas | Guarantee, Cupo, Contract | POST /quotas (existente) | crear | cupos, guarantees, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Aseguradora es texto de catálogo, no entidad autónoma; validar cupos y filtros. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/aseguradoras` | Resumen de aseguradoras, matriz de cobertura y cupos | Guarantee, Cupo, Contract | GET /insurers, /quotas, /contracts, /guarantees (existentes) | sesión; VER servidor | guarantees, cupos, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Aseguradora es texto de catálogo, no entidad autónoma; validar cupos y filtros. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/auditoria` | Bitácora global, tabla y cronología con filtros | AuditEntry, User, Contract | GET /audit (existente) | auditar | audit_log, users, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | IP simulada del front; exporte global de auditoría fuera de r_aud no tiene ruta específica. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/calendario` | Calendario de eventos en modo mes, semana y día | Contract, Obligation, Deliverable, Guarantee, Acta, AuditEntry | GET /contracts y colecciones de eventos; agregado calendario/agenda AUSENTE | sesión; VER servidor | contracts, obligations, deliverables, guarantees, actas, audit_log | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | No hay endpoint agregado; eventos de auditoría visibles bajo una vista sin guard auditar explícito. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/configuracion` | Parámetros, catálogos, usuarios, roles, empresas y respaldo demo | Settings, User, Company, roles/catálogos | GET/PUT /settings; GET/PUT /catalogs/:nombre; GET/POST/PUT /users; GET/PUT /roles/permissions; respaldo/restauración API AUSENTES | ADMINISTRADOR | settings, catalogs, catalog_items, users, role_permissions, companies | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | GET settings/catalogs/users solo administrador; formularios de otros roles necesitan lectura segura de catálogos/directorio. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/configuracion/usuarios/nuevo` | Crear users | Settings, User, Company, roles/catálogos | POST /users (existente) | ADMINISTRADOR + crear | users, role_permissions | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | GET settings/catalogs/users solo administrador; formularios de otros roles necesitan lectura segura de catálogos/directorio. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/configuracion/usuarios/[userId]/editar` | Editar users | Settings, User, Company, roles/catálogos | PUT /users/:id (existente) | ADMINISTRADOR + editar | users, role_permissions | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | GET settings/catalogs/users solo administrador; formularios de otros roles necesitan lectura segura de catálogos/directorio. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/contrato/[id]/actas/nueva` | Crear actas validando pertenencia al expediente | Contract y todas sus colecciones | POST /actas (existente); GET /contracts/:id para contexto | crear | actas, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Efectos, anulaciones y operaciones múltiples requieren transacción; no enviar métricas del cliente. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/contrato/[id]/conciliacion` | Comparación de ocho campos sistema/documento y diferencias | Contract y todas sus colecciones | GET /contracts/:id/reconcile; POST /documents/:id/extract y PUT /documents/:id/extracted si se añade corrección (existentes) | ver | contracts y 12 colecciones hijas | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Efectos, anulaciones y operaciones múltiples requieren transacción; no enviar métricas del cliente. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/contrato/[id]/documentos/nueva` | Crear documents validando pertenencia al expediente | Contract y todas sus colecciones | POST /documents (existente); GET /contracts/:id para contexto multipart; no nombre/ruta simulada | crear | documents, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Efectos, anulaciones y operaciones múltiples requieren transacción; no enviar métricas del cliente. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/contrato/[id]/editar` | Editar contracts validando pertenencia al expediente | Contract y todas sus colecciones | PUT /contracts/:id (existente); GET /contracts/:id para contexto | editar | contracts y 12 colecciones hijas | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Efectos, anulaciones y operaciones múltiples requieren transacción; no enviar métricas del cliente. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/contrato/[id]/ejecucion/nueva` | Crear execs validando pertenencia al expediente | Contract y todas sus colecciones | POST /execs (existente); GET /contracts/:id para contexto | crear | execs, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Efectos, anulaciones y operaciones múltiples requieren transacción; no enviar métricas del cliente. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/contrato/[id]/ejecucion/[executionId]/editar` | Editar execs validando pertenencia al expediente | Contract y todas sus colecciones | PUT /execs/:id (existente); GET /contracts/:id para contexto; GET /execs/:id AUSENTE (recuperar desde colección es alternativa provisional) | editar | execs, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Efectos, anulaciones y operaciones múltiples requieren transacción; no enviar métricas del cliente. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/contrato/[id]/entregables/nueva` | Crear deliverables validando pertenencia al expediente | Contract y todas sus colecciones | POST /deliverables (existente); GET /contracts/:id para contexto | crear | deliverables, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Efectos, anulaciones y operaciones múltiples requieren transacción; no enviar métricas del cliente. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/contrato/[id]/entregables/[deliverableId]/editar` | Editar deliverables validando pertenencia al expediente | Contract y todas sus colecciones | PUT /deliverables/:id (existente); GET /contracts/:id para contexto; GET /deliverables/:id AUSENTE (recuperar desde colección es alternativa provisional) | editar | deliverables, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Efectos, anulaciones y operaciones múltiples requieren transacción; no enviar métricas del cliente. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/contrato/[id]/entregables/[deliverableId]/entrega/editar` | Editar estado, fecha real, avance y evidencia de entrega validando pertenencia al expediente | Contract y todas sus colecciones | PUT /deliverables/:id (existente); GET /contracts/:id para contexto; GET /deliverables/:id AUSENTE (recuperar desde colección es alternativa provisional) | editar | deliverables, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Efectos, anulaciones y operaciones múltiples requieren transacción; no enviar métricas del cliente. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/contrato/[id]/garantias/nueva` | Crear guarantees validando pertenencia al expediente | Contract y todas sus colecciones | POST /guarantees (existente); GET /contracts/:id para contexto | crear | guarantees, cupos, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Efectos, anulaciones y operaciones múltiples requieren transacción; no enviar métricas del cliente. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/contrato/[id]/incumplimientos/nueva` | Crear breaches validando pertenencia al expediente | Contract y todas sus colecciones | POST /breaches (existente); GET /contracts/:id para contexto | crear | breaches, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Efectos, anulaciones y operaciones múltiples requieren transacción; no enviar métricas del cliente. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/contrato/[id]/incumplimientos/[breachId]/editar` | Editar breaches validando pertenencia al expediente | Contract y todas sus colecciones | PUT /breaches/:id (existente); GET /contracts/:id para contexto; GET /breaches/:id AUSENTE (recuperar desde colección es alternativa provisional) | editar | breaches, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Efectos, anulaciones y operaciones múltiples requieren transacción; no enviar métricas del cliente. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/contrato/[id]/modificaciones/nueva` | Crear modifications validando pertenencia al expediente | Contract y todas sus colecciones | POST /modifications (existente); GET /contracts/:id para contexto | editar | modifications, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Efectos, anulaciones y operaciones múltiples requieren transacción; no enviar métricas del cliente. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/contrato/[id]/obligaciones/nueva` | Crear obligations validando pertenencia al expediente | Contract y todas sus colecciones | POST /obligations (existente); GET /contracts/:id para contexto | crear | obligations, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Efectos, anulaciones y operaciones múltiples requieren transacción; no enviar métricas del cliente. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/contrato/[id]` | 17 pestañas; editar, validar, conciliar, exportar JSON/PDF simulado, notificar, anular | Contract y todas sus colecciones | GET /contracts/:id y /contracts/:id/{colección}; GET /contracts/:id/timeline y /audit; POST /void y /notify (existentes) | sesión; VER servidor | contracts y 12 colecciones hijas | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Efectos, anulaciones y operaciones múltiples requieren transacción; no enviar métricas del cliente. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/contrato/[id]/pagos/nueva` | Crear payments validando pertenencia al expediente | Contract y todas sus colecciones | POST /payments (existente); GET /contracts/:id para contexto | crear | payments, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Efectos, anulaciones y operaciones múltiples requieren transacción; no enviar métricas del cliente. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/contrato/[id]/planes/nueva` | Crear plans validando pertenencia al expediente | Contract y todas sus colecciones | POST /plans (existente); GET /contracts/:id para contexto | crear | plans, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Efectos, anulaciones y operaciones múltiples requieren transacción; no enviar métricas del cliente. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/contrato/[id]/planes/[planId]/editar` | Editar plans validando pertenencia al expediente | Contract y todas sus colecciones | PUT /plans/:id (existente); GET /contracts/:id para contexto; GET /plans/:id AUSENTE (recuperar desde colección es alternativa provisional) | editar | plans, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Efectos, anulaciones y operaciones múltiples requieren transacción; no enviar métricas del cliente. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/contrato/[id]/prorrogas/nueva` | Prórroga: nueva fecha/días, justificación y aviso de pólizas | Contract y todas sus colecciones | POST /modifications (existente); GET /contracts/:id para contexto | editar | modifications, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Efectos, anulaciones y operaciones múltiples requieren transacción; no enviar métricas del cliente. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/contrato/[id]/reinicios/nueva` | Crear modifications validando pertenencia al expediente | Contract y todas sus colecciones | POST /modifications (existente); GET /contracts/:id para contexto y POST /actas, efecto sobre contrato (sin comando compuesto equivalente) | editar | modifications, contracts, actas | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Efectos, anulaciones y operaciones múltiples requieren transacción; no enviar métricas del cliente. Falta operación atómica modificación+acta. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/contrato/[id]/riesgos/nueva` | Crear risks validando pertenencia al expediente | Contract y todas sus colecciones | POST /risks (existente); GET /contracts/:id para contexto | crear | risks, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Efectos, anulaciones y operaciones múltiples requieren transacción; no enviar métricas del cliente. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/contrato/[id]/riesgos/[riskId]/editar` | Editar risks validando pertenencia al expediente | Contract y todas sus colecciones | PUT /risks/:id (existente); GET /contracts/:id para contexto; GET /risks/:id AUSENTE (recuperar desde colección es alternativa provisional) | editar | risks, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Efectos, anulaciones y operaciones múltiples requieren transacción; no enviar métricas del cliente. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/contrato/[id]/subcontratos/nueva` | Crear subcontracts validando pertenencia al expediente | Contract y todas sus colecciones | POST /subcontracts (existente); GET /contracts/:id para contexto | crear | subcontracts, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Efectos, anulaciones y operaciones múltiples requieren transacción; no enviar métricas del cliente. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/contrato/[id]/subcontratos/[subcontractId]/editar` | Editar subcontracts validando pertenencia al expediente | Contract y todas sus colecciones | PUT /subcontracts/:id (existente); GET /contracts/:id para contexto; GET /subcontracts/:id AUSENTE (recuperar desde colección es alternativa provisional) | editar | subcontracts, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Efectos, anulaciones y operaciones múltiples requieren transacción; no enviar métricas del cliente. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/contrato/[id]/suspensiones/nueva` | Crear modifications validando pertenencia al expediente | Contract y todas sus colecciones | POST /modifications (existente); GET /contracts/:id para contexto y POST /actas, efecto sobre contrato (sin comando compuesto equivalente) | editar | modifications, contracts, actas | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Efectos, anulaciones y operaciones múltiples requieren transacción; no enviar métricas del cliente. Falta operación atómica modificación+acta. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/contrato/[id]/validacion` | Validación 13 áreas, severidades, valores y recomendaciones | Contract y todas sus colecciones | POST /contracts/:id/validate (existente); exporte de incidencias específico AUSENTE | ver | contracts y 12 colecciones hijas | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Efectos, anulaciones y operaciones múltiples requieren transacción; no enviar métricas del cliente. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/contratos/nuevo` | Crear contracts | Contract, Company, CMetrics | POST /contracts (existente); GET /contracts/:id para contexto | crear | contracts, companies y colecciones hijas | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Front filtra estado efectivo, empresa/nivel abreviados; API filtra estado almacenado y no busca NIT. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/contratos` | Portafolio con filtros, semáforo, indicadores y exportación | Contract, Company, CMetrics | GET /contracts (existente) | sesión; VER servidor | contracts, companies y colecciones hijas | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Front filtra estado efectivo, empresa/nivel abreviados; API filtra estado almacenado y no busca NIT. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/dashboard` | Dashboard operativo, 14 KPIs, 8 gráficas, mapa y pendientes | Contract, CMetrics, Alert, Obligation, Guarantee, Risk, Exec, Payment | GET /contracts, /execs, /payments, /guarantees, /obligations, /breaches; /geo/departments y /geo/regions para mapa; agregado dedicado AUSENTE | sesión; VER servidor | contracts y dominio completo | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | No hay endpoint agregado de dashboard; discrepancias de universos y conAlerta. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/documentos/nuevo` | Crear documents | Document, DocumentVersion, Contract | POST /documents (existente) multipart; no nombre/ruta simulada | crear | documents, document_versions, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Faltan GET global y GET por ID; multipart real frente a nombre de archivo; orden de versiones inverso. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/documentos` | Repositorio documental global, ficha y versiones | Document, DocumentVersion, Contract | GET /documents con búsqueda/filtros/paginación AUSENTE; POST /documents y /documents/:id/void existentes | sesión; VER servidor | documents, document_versions, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Faltan GET global y GET por ID; multipart real frente a nombre de archivo; orden de versiones inverso. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/documentos/[documentId]` | Ficha documental, contrato asociado, historial y nueva versión | Document, DocumentVersion, Contract | GET /documents/:id con versions AUSENTE; descarga firmada existente internamente sin endpoint emisor | ver | documents, document_versions, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Faltan GET global y GET por ID; multipart real frente a nombre de archivo; orden de versiones inverso. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/documentos/[documentId]/versiones/nueva` | Agregar versión; archivo, motivo/cambios y conservar historial | Document, DocumentVersion, Contract | GET /documents/:id AUSENTE; POST /documents/:id/versions multipart existente | editar | documents, document_versions, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Faltan GET global y GET por ID; multipart real frente a nombre de archivo; orden de versiones inverso. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/ejecucion/nueva` | Crear execs | Exec, Contract, CMetrics | POST /execs (existente) | crear | execs, contracts, payments | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Brecha fija de 15 frente a gapPct configurable; el formulario guarda avance en Exec y M(c) usa Contract.avanceFisico, sin sincronización observada. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/ejecucion` | Consolidado de ejecución y reportes mensuales | Exec, Contract, CMetrics | GET /execs (existente) | sesión; VER servidor | execs, contracts, payments | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Brecha fija de 15 frente a gapPct configurable; el formulario guarda avance en Exec y M(c) usa Contract.avanceFisico, sin sincronización observada. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/empresas/nueva` | Crear companies | Company, Contract, CMetrics | POST /companies (existente) | crear | companies, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Valor histórico base frente a actualizado; nulidad e inactividad son estados diferentes. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/empresas` | Directorio de empresas contratantes y ficha institucional | Company, Contract, CMetrics | GET /companies (existente) | sesión; VER servidor | companies, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Valor histórico base frente a actualizado; nulidad e inactividad son estados diferentes. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/empresas/[id]/editar` | Editar companies | Company, Contract, CMetrics | PUT /companies/:id (existente) | editar | companies, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Valor histórico base frente a actualizado; nulidad e inactividad son estados diferentes. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/empresas/[id]` | Ficha, datos institucionales, cuatro indicadores y contratos asociados | Company, Contract, CMetrics | GET /companies/:id; GET /contracts?companyId=:id (existentes) | sesión; VER servidor | companies, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Valor histórico base frente a actualizado; nulidad e inactividad son estados diferentes. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/garantias/nueva` | Crear guarantees | Guarantee, Cupo, Contract | POST /guarantees (existente) | crear | guarantees, cupos, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Valor/cupo insuficiente es aviso aceptable en formulario global y regla servidor; faltan lecturas por ID. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/garantias` | Pólizas, amparos, vigencias, modalidad y aprobación | Guarantee, Cupo, Contract | GET /guarantees (existente) | sesión; VER servidor | guarantees, cupos, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Valor/cupo insuficiente es aviso aceptable en formulario global y regla servidor; faltan lecturas por ID. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/gerencia` | Control gerencial con 8 KPIs, 3 gráficas y contratos críticos | Contract, CMetrics, Guarantee, Breach, Obligation, Exec, Payment | GET /contracts, /execs, /payments, /guarantees, /obligations, /breaches existentes; agregado gerencial dedicado AUSENTE | sesión; VER servidor | contracts, execs, payments, guarantees, obligations, breaches | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | No hay endpoint agregado; acumulado empieza en ventana de 12 meses; universos no homogéneos. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/incumplimientos/nuevo` | Crear breaches | Breach, Plan, Obligation, Contract | POST /breaches (existente) | crear | breaches, plans, obligations, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | planAccion/fechas globales no son campos DTO; cierre no equivale a void. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/incumplimientos` | Incumplimientos, multas y planes de mejoramiento | Breach, Plan, Obligation, Contract | GET /breaches (existente); GET /plans; PUT /breaches/:id y /plans/:id para cierres | sesión; VER servidor | breaches, plans, obligations, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | planAccion/fechas globales no son campos DTO; cierre no equivale a void. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/incumplimientos/planes/nuevo` | Crear plans | Breach, Plan, Obligation, Contract | POST /plans (existente) | crear | plans, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | planAccion/fechas globales no son campos DTO; cierre no equivale a void. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/incumplimientos/planes/[planId]/editar` | Editar plans | Breach, Plan, Obligation, Contract | PUT /plans/:id (existente); GET /plans/:id AUSENTE (recuperar desde colección es alternativa provisional) | editar | plans, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | planAccion/fechas globales no son campos DTO; cierre no equivale a void. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/incumplimientos/[breachId]/editar` | Editar breaches | Breach, Plan, Obligation, Contract | PUT /breaches/:id (existente); GET /breaches/:id AUSENTE (recuperar desde colección es alternativa provisional) | editar | breaches, plans, obligations, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | planAccion/fechas globales no son campos DTO; cierre no equivale a void. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/modificaciones/nueva` | Crear modifications | Modification, Contract, Guarantee | POST /modifications (existente) | editar | modifications, contracts, guarantees | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Front usa editar, API crear; Modificación de cláusula no está en TIPOS_MOD; void no revierte efectos. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/modificaciones` | Historial de cambios con efectos económicos, plazo y sujetos | Modification, Contract, Guarantee | GET /modifications (existente) | sesión; VER servidor | modifications, contracts, guarantees | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Front usa editar, API crear; Modificación de cláusula no está en TIPOS_MOD; void no revierte efectos. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/obligaciones` | Obligaciones, ficha, seguimiento y aprobación de cumplimiento | Obligation, Contract, checklist/comentarios/evidencias | GET /obligations (existente) | sesión; VER servidor | obligations, obligation_checklist, obligation_comments, obligation_evidences, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | listo versus hecho; checklist cumplido y verificación son conceptos diferentes. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/obligaciones/[id]` | Ficha; checklist estándar/custom, cumplimiento automático, comentarios, evidencias mostradas y verificación | Obligation, Contract, checklist/comentarios/evidencias | GET /obligations/:id; POST /:id/checklist\|comments\|evidences\|verify; PUT /:id/checklist/:itemId (existentes) | ver | obligations, obligation_checklist, obligation_comments, obligation_evidences, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | listo versus hecho; checklist cumplido y verificación son conceptos diferentes. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/pagos/nuevo` | Crear payments | Payment, Contract, CMetrics | POST /payments (existente) | crear | payments, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Factura opcional en front y requerida en DTO; neto versus bruto+IVA en agregados. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/pagos` | Pagos, facturas, impuestos, aprobaciones y desembolsos | Payment, Contract, CMetrics | GET /payments (existente); POST /payments/:id/approve\|pay | sesión; VER servidor | payments, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Factura opcional en front y requerida en DTO; neto versus bruto+IVA en agregados. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/reportes` | Catálogo de 19 reportes, consulta, Excel/PDF/CSV/impresión | 19 proyecciones de entidades contractuales | Catálogo local de 19 claves; GET /reports/:key?format=json\|xlsx\|pdf; catálogo HTTP AUSENTE | sesión; VER servidor | tablas de cada proyección; no tabla reports | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | API exige EXPORTAR incluso JSON; CSV no está implementado; no hay filtros de periodo UI. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/reportes/[reportKey]` | Catálogo de 19 reportes, consulta, Excel/PDF/CSV/impresión | 19 proyecciones de entidades contractuales | GET /reports/:key?format=json\|xlsx\|pdf existente (19 claves); CSV AUSENTE; impresión cliente | ver | tablas de cada proyección; no tabla reports | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | API exige EXPORTAR incluso JSON; CSV no está implementado; no hay filtros de periodo UI. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/riesgos/nuevo` | Crear risks | Risk, Contract | POST /risks (existente) | crear | risks, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | descripcion/probabilidad global versus riesgo/prob DTO; cierre global exige anular, expediente editar. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/riesgos` | Matriz 5×5, categorías, niveles y mitigación | Risk, Contract | GET /risks (existente); PUT /risks/:id para cierre | sesión; VER servidor | risks, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | descripcion/probabilidad global versus riesgo/prob DTO; cierre global exige anular, expediente editar. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/riesgos/[riskId]/editar` | Editar risks | Risk, Contract | PUT /risks/:id (existente); GET /risks/:id AUSENTE (recuperar desde colección es alternativa provisional) | editar | risks, contracts | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | descripcion/probabilidad global versus riesgo/prob DTO; cierre global exige anular, expediente editar. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/subcontratos/nuevo` | Crear subcontracts | SubContract, Contract, Company | POST /subcontracts (existente) | crear | subcontracts, contracts, companies | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Tope en frontend global; falta plazo máximo servidor y controles equivalentes en formulario expediente. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/subcontratos` | Subcontratación en tabla y árbol empresa/contrato | SubContract, Contract, Company | GET /subcontracts (existente); GET /contracts y /companies para árbol | sesión; VER servidor | subcontracts, contracts, companies | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Tope en frontend global; falta plazo máximo servidor y controles equivalentes en formulario expediente. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/subcontratos/[id]/editar` | Editar subcontracts | SubContract, Contract, Company | PUT /subcontracts/:id (existente); GET /subcontracts/:id AUSENTE (recuperar desde colección es alternativa provisional) | editar | subcontracts, contracts, companies | Store y MCACHE donde se usan métricas; cache servidor propuesta por dependencias | Tope en frontend global; falta plazo máximo servidor y controles equivalentes en formulario expediente. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |
| `/login` | Email, contraseña demo, recordar sesión, ayuda y usuarios demo | User, sesión y permisos | POST /auth/login; GET /me (existentes) | público | users, role_permissions, audit_log | Flag local/sessionStorage; sin token real | Cualquier contraseña de seis caracteres funciona en front; API solo correo, sin logout/refresh/OIDC. | Función/permisos [CONFIRMADO por frontend]; HTTP/tablas/cache servidor [INFERIDO razonable]; decisiones [REQUIERE VALIDACION DE NEGOCIO] |

### 2.2 Subvistas del expediente y configuración

Las pestañas comparten `/contrato/[id]?tab=…`; no son páginas adicionales. Colecciones: subcontracts, obligations, deliverables, execs, payments, guarantees, actas, modifications, risks, breaches, plans y documents. Diez colecciones CRUD usan ChildCollectionsController; guarantees y documents tienen módulo especializado. A continuación se individualizan las funciones; el mapeo de tablas ya está en la matriz.

| Subvista | Función / endpoint esperado | Permisos observados / API | Riesgo y estado |
|---|---|---|---|
| `?tab=resumen` | Valores, saldos, fechas, tiempo, avance, obligaciones, garantías, riesgos, semáforo y ControlScore; GET /contracts/:id | consulta | Métricas API no tienen todos los contadores de CMetrics. Función [CONFIRMADO por frontend]; mapeo [INFERIDO razonable]; política [REQUIERE VALIDACION DE NEGOCIO] |
| `?tab=info` | Identificación, contratante/contratista, objeto, alcance, responsables, ubicación, fechas y valores; GET /contracts/:id | consulta; edición en ruta dedicada | Aliases deben normalizarse. Función [CONFIRMADO por frontend]; mapeo [INFERIDO razonable]; política [REQUIERE VALIDACION DE NEGOCIO] |
| `?tab=documentos` | Categorías requeridas/faltantes, historial de versiones, nueva carga, nueva versión, anular; GET /contracts/:id/documents y POST documents | crear/editar/anular en handlers | Versiones API en orden descendente, front usa último elemento. Función [CONFIRMADO por frontend]; mapeo [INFERIDO razonable]; política [REQUIERE VALIDACION DE NEGOCIO] |
| `?tab=obligaciones` | Filtros todas/vencidas/por vencer ≤15d/sin verificar, búsqueda, KPIs, ficha y creación; GET colección por contrato | crear; ficha editar/aprobar | Vencido efectivo no es estado persistido. Función [CONFIRMADO por frontend]; mapeo [INFERIDO razonable]; política [REQUIERE VALIDACION DE NEGOCIO] |
| `?tab=entregables` | Crear, editar planificación, registrar entrega, estado/avance/evidencia, KPIs y eliminación local; GET/POST/PUT deliverables | crear/editar; borrado editar | El backend prohíbe borrado físico; void requiere ANULAR y motivo. Función [CONFIRMADO por frontend]; mapeo [INFERIDO razonable]; política [REQUIERE VALIDACION DE NEGOCIO] |
| `?tab=ejecucion` | Historial mensual, valor/avance, finanzas, agotamiento, gráficos ejecución/pagos y edición/eliminación; GET/POST/PUT execs | crear/editar; borrado editar | El formulario guarda avance en Exec, pero M(c) usa Contract.avanceFisico; no se observa sincronización automática. Función [CONFIRMADO por frontend]; mapeo [INFERIDO razonable]; política [REQUIERE VALIDACION DE NEGOCIO] |
| `?tab=pagos` | Bruto/IVA/retenciones/neto, pendientes, trámite/en revisión, aprobar y pagar; GET payments, POST approve/pay | crear/aprobar | No equiparar total neto de pagos y pagado bruto+IVA contractual. Función [CONFIRMADO por frontend]; mapeo [INFERIDO razonable]; política [REQUIERE VALIDACION DE NEGOCIO] |
| `?tab=garantias` | Pólizas por amparo, modalidad/cupo, cobertura, vigencias y aprobación; GET garantías, POST approve | crear/aprobar | Reglas de cupo deben comprobarse al aprobar también. Función [CONFIRMADO por frontend]; mapeo [INFERIDO razonable]; política [REQUIERE VALIDACION DE NEGOCIO] |
| `?tab=actas` | Filtrar por tipo, crear, soporte, estado firma y anular; GET actas, POST void | crear/anular en expediente | Global usa editar para anular; front tiene firmantes no aceptado por DTO. Función [CONFIRMADO por frontend]; mapeo [INFERIDO razonable]; política [REQUIERE VALIDACION DE NEGOCIO] |
| `?tab=modificaciones` | Historial, total adiciones/reducciones, prórrogas, crear y anular con reversión parcial, eliminación física local; POST modifications /void | editar en handlers; API CREAR/ANULAR | Anulación backend no revierte efectos del contrato. Función [CONFIRMADO por frontend]; mapeo [INFERIDO razonable]; política [REQUIERE VALIDACION DE NEGOCIO] |
| `?tab=suspensiones` | Suspensión/reinicio según estado, historial de modificaciones y actas, días compensados, anular/eliminar; POST modifications y actas | editar | Front registra acta y modificación; API no compone ambas en una transacción. Función [CONFIRMADO por frontend]; mapeo [INFERIDO razonable]; política [REQUIERE VALIDACION DE NEGOCIO] |
| `?tab=prorrogas` | Fecha anterior/nueva, plazo inicial, días prorrogados, crear, anular y eliminar; POST modifications tipo Prórroga | editar | Restaurar fecha anterior sin recomputar actuaciones posteriores puede ser incorrecto. Función [CONFIRMADO por frontend]; mapeo [INFERIDO razonable]; política [REQUIERE VALIDACION DE NEGOCIO] |
| `?tab=riesgos` | Matriz P×I, KPIs, filtros por celda, crear/editar/cambiar estado/eliminar; GET/POST/PUT risks | crear/editar; borrado editar | No existe entidad autónoma matriz; cierre y anulación son distintos. Función [CONFIRMADO por frontend]; mapeo [INFERIDO razonable]; política [REQUIERE VALIDACION DE NEGOCIO] |
| `?tab=incumplimientos` | Incumplimientos asociados a obligación; medidas/multas; planes, hallazgo, causa, compromiso, avance; GET breaches/plans | crear/editar; borrado editar | No hay breachId en Plan; asociación plan-incumplimiento solo inferida. Función [CONFIRMADO por frontend]; mapeo [INFERIDO razonable]; política [REQUIERE VALIDACION DE NEGOCIO] |
| `?tab=subcontratos` | Cantidad/valor/% principal, ejecución, árbol, crear/editar/eliminar; GET/POST/PUT subcontracts | crear/editar; borrado editar | Tope y plazo deben reevaluarse al cambiar contrato principal. Función [CONFIRMADO por frontend]; mapeo [INFERIDO razonable]; política [REQUIERE VALIDACION DE NEGOCIO] |
| `?tab=auditoria` | Tabla por usuario/módulo/búsqueda, valores antes/después y exporte; GET /contracts/:id/audit | API AUDITAR; TabAuditoria sin guard propio observado | Acceso directo a tab no debe eludir permiso servidor. Función [CONFIRMADO por frontend]; mapeo [INFERIDO razonable]; política [REQUIERE VALIDACION DE NEGOCIO] |
| `?tab=timeline` | Orden cronológico firma/inicio/fin, actas, garantías, ejecución, pagos, modificaciones, incumplimientos, auditoría; GET /contracts/:id/timeline | consulta; API VER | Exponer cronología resumida no autoriza bitácora completa. Función [CONFIRMADO por frontend]; mapeo [INFERIDO razonable]; política [REQUIERE VALIDACION DE NEGOCIO] |

Configuración `?tab=alertas|catalogos|usuarios|permisos|empresas|datos`: parámetros de umbral y agotamiento; catálogo editable; alta/edición/activar-inactivar usuarios; matriz rol×permiso; navegación a empresas; descarga JSON y reset demo. Todas requieren rol ADMINISTRADOR en la página. Respaldo/reset son locales, no operaciones PostgreSQL existentes. [CONFIRMADO por frontend] para las seis funciones; trasladar backup/restore o reset a producción es [REQUIERE VALIDACION DE NEGOCIO].

### 2.3 Detalle de listas y tablas visuales

Fuente de cada línea: componente indicado. Los filtros son estado local/URL, no llamadas HTTP. Las opciones de catálogo se enumeran en 3.3 y las decisiones de integración en 7. Indicadores se calculan generalmente sobre el universo completo cargado, mientras tabla/exporte aplica filtros; no asumir que cambiar un filtro altera los KPIs.

- **ActasView.tsx** [CONFIRMADO por frontend]: filtros/vistas `filterTipo, filterContract, q`; KPIs Total Actas; Firmadas; En firmas; Borradores; Anuladas; columnas Contrato; Número; Tipo de Acta; Fecha; Descripción / Objeto; Firmantes; Estado; Soporte; Acciones; página 10. Fuente: `components/views/ActasView.tsx`.
- **AgendaView.tsx** [CONFIRMADO por frontend]: filtros/vistas `ninguno`; KPIs no tarjetas Kpi (consultar controles específicos); columnas Número; Empresa; Contratista; Objeto; Inicio; Terminación; Días restantes; Estado; Responsable; Acciones; página sin paginación explícita. Fuente: `components/views/AgendaView.tsx`.
- **AlertasView.tsx** [CONFIRMADO por frontend]: filtros/vistas `nivelFilter, estadoFilter`; KPIs Críticas; Riesgo; Próximas; Informativas; Resueltas; Tareas abiertas; columnas sin tabla convencional; página sin paginación explícita. Fuente: `components/views/AlertasView.tsx`.
- **AseguradorasView.tsx** [CONFIRMADO por frontend]: filtros/vistas `ninguno`; KPIs Aseguradoras activas; Pólizas vigentes; Valor Asegurado Total; Pólizas por cupo; Cupos vigentes; Cupo utilizado; Contratos multi-aseguradora; Contratos sin pólizas; columnas Contrato; Contratista; Valor Contrato; Pólizas; Número de Cupo; Aseguradora; Tomador; Valor Cupo; Utilizado; Disponible; % Uso; Inicio; Vencimiento; Estado; página 10. Fuente: `components/views/AseguradorasView.tsx`.
- **AuditoriaView.tsx** [CONFIRMADO por frontend]: filtros/vistas `modo, filterUser, filterContract, filterDesde, filterHasta, filterAccion, filterModulo, filterCampo`; KPIs Registros totales; Registros de hoy; Usuarios con actividad; Modificaciones; Anulaciones; columnas Fecha / Hora; Usuario; Rol; Módulo; Acción; Contrato; Campo; Anterior; Nuevo; Observación; página 15. Fuente: `components/views/AuditoriaView.tsx`.
- **CalendarioView.tsx** [CONFIRMADO por frontend]: filtros/vistas `mode, currentDate`; KPIs no tarjetas Kpi (consultar controles específicos); columnas sin tabla convencional; página sin paginación explícita. Fuente: `components/views/CalendarioView.tsx`.
- **ConfiguracionView.tsx** [CONFIRMADO por frontend]: filtros/vistas `activeTab`; KPIs no tarjetas Kpi (consultar controles específicos); columnas ID; Nombre; Email; Rol; Estado; Acciones; Rol; Usuarios; Razón social; NIT; Estado; página sin paginación explícita. Fuente: `components/views/ConfiguracionView.tsx`.
- **ContratosView.tsx** [CONFIRMADO por frontend]: filtros/vistas `q, estado, empresa, nivel, vista, depto, region` sincronizados con URL; KPIs Total Registros; Contratos Activos; Vencidos / Críticos; En Atención / Riesgo; Compromiso Total; columnas Sem; Número; Empresa; Contratista y Objeto; Estado; Valor Actual; Avance Fin.; Días Restantes; Acciones; página 12. Fuente: `components/views/ContratosView.tsx`.
- **DocumentosView.tsx** [CONFIRMADO por frontend]: filtros/vistas `q, filterContract, filterCat`; KPIs Total Documentos; Versiones Totales; Contratos con Faltantes; Documentos Anulados; columnas Contrato; Categoría; Nombre del Documento; Archivo Actual; Versión; Fecha; Usuario; Estado; Acciones; Versión; Fecha; Usuario; Archivo; Motivo / Cambios; página 10. Fuente: `components/views/DocumentosView.tsx`.
- **EjecucionView.tsx** [CONFIRMADO por frontend]: filtros/vistas `q, filterGap`; KPIs Total Administrado; Total Ejecutado; % Ejecución Financiera; % Ejecución Física Promedio; columnas Contrato; Empresa; Contratista; Valor Actualizado; Ejecutado; Saldo; % Financiero; % Físico; Brecha; Proyección Agotamiento; Acciones; página 12. Fuente: `components/views/EjecucionView.tsx`.
- **EmpresaView.tsx** [CONFIRMADO por frontend]: filtros/vistas `ninguno`; KPIs Contratos Registrados; Contratos Activos; Valor Histórico Total; Ejecución Financiera Prom.; columnas Número; Objeto Contractual; Estado; Valor Contratado; Vigencia; Avance Financiero; Expediente; página sin paginación explícita. Fuente: `components/views/EmpresaView.tsx`.
- **EmpresasView.tsx** [CONFIRMADO por frontend]: filtros/vistas `q, filterTipo, statusChip`; KPIs Total Empresas; Empresas Activas; Inactivas / Anuladas; Contratos Vinculados; columnas NIT; Razón Social; Representante Legal; Naturaleza; Contratos; Estado; Acciones; página 10. Fuente: `components/views/EmpresasView.tsx`.
- **GarantiasView.tsx** [CONFIRMADO por frontend]: filtros/vistas `activeTab, filterAseg, filterTipo, q`; KPIs Total Pólizas; Valor Asegurado Total; Pólizas Vigentes; Vencen ≤ 30 días; Pólizas Vencidas; columnas Contrato; Aseguradora; Póliza #; Modalidad; Tipo de Garantía; Valor Asegurado; Inicio; Vencimiento; Días Restantes; Estado; Acciones; página 10. Fuente: `components/views/GarantiasView.tsx`.
- **IncumplimientosView.tsx** [CONFIRMADO por frontend]: filtros/vistas `qB, filterBEstado, filterBImpacto`; KPIs Incumplimientos; Abiertos; Impacto alto; Multas / sanciones; Planes de mejoramiento; columnas ID; Contrato; Fecha; Tipo; Descripción; Impacto; Multa; Plan de acción; Responsable; Estado; Acciones; ID; Contrato; Acción / Compromiso; Responsable; Fecha inicio; Fecha compromiso; % Avance; Estado; Acciones; página 12. Fuente: `components/views/IncumplimientosView.tsx`.
- **ModificacionesView.tsx** [CONFIRMADO por frontend]: filtros/vistas `filterTipo, filterContract, q`; KPIs Total Modificaciones; Total Adiciones; Total Reducciones; Prórrogas Suscritas; columnas Contrato; Número; Tipo; Fecha; Justificación / Impacto; Cambio de Valor; Cambio de Plazo; Nuevo Texto; Soporte; Acciones; página 12. Fuente: `components/views/ModificacionesView.tsx`.
- **ObligacionesView.tsx** [CONFIRMADO por frontend]: filtros/vistas `activeTab, filterTipo, filterContract, q`; KPIs Total Obligaciones; Cumplimiento Promedio; Pendientes; Vencidas / En riesgo; columnas Contrato; Tipo; Descripción; Responsable; Vencimiento; % Avance; Estado; Verificado; Acciones; página 12. Fuente: `components/views/ObligacionesView.tsx`.
- **PagosView.tsx** [CONFIRMADO por frontend]: filtros/vistas `activeTab, filterContract, q`; KPIs Total Pagado (Neto); Pendiente de Pago; Retenciones Acumuladas; Pagos en Trámite; columnas Contrato; Pago #; Fecha; Factura; Periodo; Bruto; IVA; Retenciones; Neto; Estado; Soporte; Acciones; página 12. Fuente: `components/views/PagosView.tsx`.
- **RiesgosView.tsx** [CONFIRMADO por frontend]: filtros/vistas `q, filterCat, filterEstado, filterSev, heatmapCell`; KPIs Riesgos identificados; Abiertos; Extremos; Altos; Sin mitigación; columnas ID; Contrato; Categoría; Descripción; P; I; Nivel; Mitigación; Responsable; Estado; Acciones; página 12. Fuente: `components/views/RiesgosView.tsx`.
- **SubcontratosView.tsx** [CONFIRMADO por frontend]: filtros/vistas `q, filterEstado, filterCompany, showTree`; KPIs Total Subcontratos; Valor Subcontratado; Subcontratos Activos; Vencidos; Ejecución Promedio; columnas Número; Subcontratista; Objeto; Valor; Vigencia; % Ejecución; Estado; Acciones; página 10. Fuente: `components/views/SubcontratosView.tsx`.


### 2.4 Interacciones específicas y criterios funcionales de las vistas principales

[CONFIRMADO por frontend]. Complementa los filtros/columnas anteriores; no añade páginas al conteo.

| Vista | Flujo, estados, filtros y navegación | Contrato de integración / incertidumbre |
|---|---|---|
| Contratos | URL q busca número, objeto, contratista, NIT; estado efectivo, empresa, nivel de semáforo, depto/región. Atajos vencidos, próximos 0..30, sobreejecución >100, riesgo/crítico. Tabla 12 y exporta filtrados, abre expediente/nuevo/editar. | Convertir empresa→companyId y nivel abreviado→nivel API; no persistir Vencido como Activo expirado. Atajos gap/docs que llegan del dashboard no tienen condición explícita en filtered: no garantizan lista específica. |
| Agenda | Solo contratos Activo efectivo/Vencido/Suspendido; cinco bloques Hoy, 1–5, 6–15, 16–30, vencidos<0. Tabla por bloque, links expediente/prórroga según acciones y XLSX/PDF/CSV con Ventana. | No incluye 31–60 como gráfico dashboard; rangos fijos no usan todos los alertDays configurables. Nulos no pertenecen a un bloque. |
| Calendario | Modos mes/semana/día (por defecto día en ancho≤620), fecha de referencia, anterior/siguiente/Hoy y toggle de ocho tipos. Inicio/fin contrato; póliza aprobada vencimiento; obligación no Cumplida fechaLimite; todos entregables fechaProg; pagos fechaPago si Pagado o fecha radicado; actas fecha; auditoría agrupada fecha/contrato. Padres anulados excluidos salvo auditoría que solo exige contrato existente. Selección de evento abre tab del expediente, desbordamiento de día abre detalle. | Fuente agregada propuesta debe exigir AUDITAR para eventos de auditoría o excluirlos; no hay eventos de tareas en este calendario. Semana inicia lunes. No inferir agenda personal/sincronización externa. |
| Alertas | Filtros nivel y estado; abiertas excluye Resuelta; contadores Críticas/Riesgo/Próximas/Informativas/Resueltas/Tareas abiertas; lectura, expediente, resolver con nota, delegar usuario y crear tarea por alertKey. Tareas se cierran/reabren Abierta/Cerrada. | API retorna gestion anidada y nueva boolean frente al estado plano del front; adaptar nivel info/informativa. Crear tarea no marca Leída en API. Ruta nueva requiere alerta válida, no tarea libre. |
| Aseguradoras | Tarjetas por aseguradora (pólizas, contratos, valor, primas, por cupo/individuales, vencidas/próximas, cupos y uso), orden valor descendente; matriz contractual de cinco aseguradoras principales; tabla cupos con dos paginaciones de 10. Links a garantías/expediente y alta cupo. | No CRUD de entidad aseguradora en frontend: nombres de catálogo. Cupos utilizados por pólizas Pendiente/Aprobada de padre no anulado. Cuotas disponibles=valor−uso, puede ser negativo. |
| Ejecución | Consolidado 12/página, q número/contratista; toggle brecha absoluta≥15 fija; financiero agregado ponderado, físico promedio simple; barras de ejecución mensual últimos 12 meses usando todos los registros; lista agotamiento anticipado; crear informe y abrir tab ejecución. | No confundir promedio físico simple de esta vista con ponderado del dashboard. Gráfico global no aplica necesariamente filtro/padres anulados del consolidado. |
| Pagos | Estados/tab y contrato/texto; bruto, IVA, retenciones, neto, soporte; alta Pendiente, revisión/aprobar/pagar con guard; indicadores de neto pagado, pendiente, retenciones y número en trámite. | Distinguir estado Aprobado de Pagado y neto del KPI financiero contractual bruto+IVA; decidir transición/fecha/soporte requerido. |
| Garantías | Tabs/aseguradora/amparo/texto; vigente, próxima≤30 y vencida respecto a hoy; modalidad individual/por cupo; alta y aprobación; enlaces expediente/cupo. | Aprobar no debe eludir saldo/cupo/aseguradora. Vencimiento calculado no equivale a estado Rechazada/Anulada. |
| Incumplimientos | Panel casos q descripción/tipo/planAccion/responsable/número contrato, estado e impacto; casos y planes paginan por separado 12; planes no heredan esos filtros; crear/editar/cerrar. | No hay relación plan.breachId; validar cómo se vincula un plan a caso. Cerrar no es anular y no debe usar void como sustituto. |
| Riesgos | Heatmap 5×5 interactivo, filtros celda/P×I, categoría, estado, nivel y texto; extremos≥15, altos10..14, moderados5..9; crea/edita/cierra. | Normalizar alias P/descripcion; coherencia de estado y mitigación, no catálogo libre de nivel persistido. |
| Subcontratos | Tabla o árbol empresa→contrato principal→subcontratos, filtro empresa/estado/texto; 10/página; valor, ejecución media y vencidos; alta/edición, expediente. | Árbol es proyección de relaciones, no una tabla jerárquica nueva; cap y plazo principal deben validarse en servidor. |
| Documentos | Global q/contrato/categoría, ficha directa y versiones; última versión, responsable/fecha/archivo, descarga/nueva versión/anular; 10/página. | Archivo actual debe obtenerse por máximo v, no posición; lista global/detalle API faltan. |
| Actas | q/tipo/contrato, número, fechas, firmas, soporte y estados Borrador/En firmas/Firmada/Anulada; alta/anular. | Metadatos de firmantes no implementan firma electrónica ni validación documental. |
| Modificaciones | q/tipo/contrato, adiciones/reducciones/prórrogas, historial de valores/plazos/texto, actuación dedicada y anulación. | Acordar reversión y tipos canónicos; Otrosí es número/radicado de actuación en form, no modelo separado confirmado. |
| Empresas | Búsqueda/naturaleza/estado; tabla y ficha con contratos; editar/crear/inactivar según acciones. Ficha usa histórico y porcentaje promedio que no coincide necesariamente con indicadores API. | Aclarar empresa contratante frente al copy que menciona contratista; Company ID del contrato es contratante, contratista es texto independiente. |
| Auditoría | Tabla/timeline, usuario/contrato/rango fechas/acción/módulo/campo, before/after, observación/IP y exportación; 15/página. | Auditoría append-only servidor, no permitir inserción libre de usuario/fecha/IP desde cliente; AUDITAR para todo canal equivalente. |
| Configuración | Seis tabs URL; añadir umbral integer1..365 no duplicado, borrar/restablecer alertDays; parámetros criticalDays/budgetPct/gapPct; catálogos agregar/quitar; permisos rol×acción; usuarios; empresas; descarga/reset demo. | Parametrización no es política aprobada; cliente usa Number(...) o fallback y no bloquea todos los rangos. Solo administrador. Validar restricciones DTO y autoridad de catálogo. |

## 3. Entidades implícitas en mocks, campos y relaciones

### 3.1 Diccionario completo de tipos frontend

Fuente: `lib/types.ts`. `UID`, `ISODate` e `ISOMonth` son strings; el tipo TypeScript no valida fecha/mes real. “?” conserva la opcionalidad del front; no equivale automáticamente a nullable en PostgreSQL. Los aliases de compatibilidad también se listan porque no se deben enviar sin normalización. Las 25 interfaces incluyen entidades, agregados y estructuras auxiliares, no 25 tablas nuevas. [CONFIRMADO por frontend].

#### User

| Campo | Tipo frontend | Obligatorio en interfaz |
|---|---|---|
| `id` | `UID` | Sí |
| `nombre` | `string` | Sí |
| `email` | `string` | Sí |
| `rol` | `'ADMINISTRADOR' ∣ 'CONTRATACIÓN' ∣ 'JURÍDICA' ∣ 'FINANCIERA' ∣ 'SUPERVISOR' ∣ 'INTERVENTOR' ∣ 'AUDITOR' ∣ 'CONSULTA' ∣ string` | Sí |
| `estado` | `'Activo' ∣ 'Inactivo' ∣ string` | Sí |
| `name` | `string` | No |
| `role` | `string` | No |
| `initials` | `string` | No |
| `perms` | `string[]` | No |
#### Company

| Campo | Tipo frontend | Obligatorio en interfaz |
|---|---|---|
| `id` | `UID` | Sí |
| `razon` | `string` | Sí |
| `nit` | `string` | Sí |
| `tipo` | `string` | No |
| `direccion` | `string` | No |
| `ciudad` | `string` | No |
| `depto` | `string` | No |
| `pais` | `string` | No |
| `rep` | `string` | No |
| `repDoc` | `string` | No |
| `tel` | `string` | No |
| `email` | `string` | No |
| `respInterno` | `string` | No |
| `estado` | `'Activa' ∣ 'Inactiva' ∣ string` | Sí |
| `fechaCreacion` | `ISODate` | No |
| `name` | `string` | No |
| `status` | `string` | No |
| `risk` | `number` | No |
| `level` | `string` | No |
| `type` | `string` | No |
#### Contract

| Campo | Tipo frontend | Obligatorio en interfaz |
|---|---|---|
| `id` | `UID` | Sí |
| `numero` | `string` | Sí |
| `tipo` | `string` | Sí |
| `modalidad` | `string` | No |
| `companyId` | `UID` | Sí |
| `contratista` | `string` | Sí |
| `nitContratista` | `string` | Sí |
| `repContratista` | `string` | No |
| `objeto` | `string` | Sí |
| `descripcion` | `string` | No |
| `alcance` | `string` | No |
| `productos` | `string` | No |
| `indicadores` | `string` | No |
| `area` | `string` | No |
| `responsable` | `string` | Sí |
| `supervisor` | `string` | Sí |
| `interventor` | `string` | No |
| `deptos` | `string[]` | No |
| `municipio` | `string` | No |
| `fechaFirma` | `ISODate` | No |
| `fechaInicio` | `ISODate` | Sí |
| `fechaFin` | `ISODate` | Sí |
| `valorBase` | `number` | Sí |
| `iva` | `number` | No |
| `otrosImp` | `number` | No |
| `adiciones` | `number` | No |
| `reducciones` | `number` | No |
| `estado` | `string` | Sí |
| `avanceFisico` | `number` | No |
| `hastaAgotar` | `boolean` | No |
| `anulado` | `boolean` | No |
| `parentId` | `UID ∣ null` | No |
| `num` | `string` | No |
| `obj` | `string` | No |
| `status` | `string` | No |
| `signDate` | `ISODate` | No |
| `startDate` | `ISODate` | No |
| `endDate` | `ISODate` | No |
| `val` | `number` | No |
| `valExec` | `number` | No |
| `cur` | `string` | No |
| `company` | `UID` | No |
| `depto` | `string` | No |
| `departamento` | `string` | No |
| `type` | `string` | No |
#### SubContract

| Campo | Tipo frontend | Obligatorio en interfaz |
|---|---|---|
| `id` | `UID` | Sí |
| `contractId` | `UID` | Sí |
| `numero` | `string` | Sí |
| `contratista` | `string` | Sí |
| `nit` | `string` | Sí |
| `objeto` | `string` | Sí |
| `valor` | `number` | Sí |
| `fechaInicio` | `ISODate` | Sí |
| `fechaFin` | `ISODate` | Sí |
| `estado` | `string` | Sí |
| `ejecucion` | `number` | No |
| `responsable` | `string` | No |
| `documentos` | `string` | No |
| `riesgos` | `string` | No |
| `obligaciones` | `string` | No |
| `val` | `number` | No |
| `startDate` | `ISODate` | No |
| `endDate` | `ISODate` | No |
| `status` | `string` | No |
#### Obligation

| Campo | Tipo frontend | Obligatorio en interfaz |
|---|---|---|
| `id` | `UID` | Sí |
| `contractId` | `UID` | Sí |
| `tipo` | `string` | Sí |
| `descripcion` | `string` | Sí |
| `responsable` | `string` | Sí |
| `fechaLimite` | `ISODate` | Sí |
| `periodicidad` | `string` | No |
| `evidencia` | `string` | No |
| `estado` | `string` | Sí |
| `cumplimiento` | `number` | No |
| `obs` | `string` | No |
| `verificadoPor` | `string` | No |
| `verificadoFecha` | `ISODate` | No |
| `checklist` | `Array<{ id: string; texto: string; listo: boolean }>` | No |
| `comentarios` | `Array<{ id: string; usuario: string; fecha: string; texto: string }>` | No |
| `evidencias` | `Array<{ id: string; nombre: string; fecha: string; url?: string }>` | No |
| `desc` | `string` | No |
| `due` | `ISODate` | No |
| `freq` | `string` | No |
| `status` | `string` | No |
| `compDate` | `ISODate` | No |
| `type` | `string` | No |
#### Deliverable

| Campo | Tipo frontend | Obligatorio en interfaz |
|---|---|---|
| `id` | `UID` | Sí |
| `contractId` | `UID` | Sí |
| `nombre` | `string` | Sí |
| `descripcion` | `string` | No |
| `fechaInicio` | `ISODate` | No |
| `fechaProg` | `ISODate` | Sí |
| `fechaReal` | `ISODate ∣ ''` | No |
| `responsable` | `string` | No |
| `estado` | `string` | Sí |
| `avance` | `number` | No |
| `evidencia` | `string` | No |
| `obs` | `string` | No |
| `name` | `string` | No |
| `due` | `ISODate` | No |
| `val` | `number` | No |
| `status` | `string` | No |
| `obligId` | `UID` | No |
#### Exec

| Campo | Tipo frontend | Obligatorio en interfaz |
|---|---|---|
| `id` | `UID` | Sí |
| `contractId` | `UID` | Sí |
| `periodo` | `ISOMonth` | Sí |
| `valor` | `number` | Sí |
| `avanceFisico` | `number` | Sí |
| `obs` | `string` | No |
| `date` | `ISODate` | No |
| `val` | `number` | No |
| `pct` | `number` | No |
#### Payment

| Campo | Tipo frontend | Obligatorio en interfaz |
|---|---|---|
| `id` | `UID` | Sí |
| `contractId` | `UID` | Sí |
| `numero` | `string` | Sí |
| `fecha` | `ISODate` | Sí |
| `factura` | `string` | No |
| `concepto` | `string` | No |
| `periodo` | `ISOMonth` | No |
| `bruto` | `number` | Sí |
| `iva` | `number` | No |
| `retenciones` | `number` | No |
| `neto` | `number` | Sí |
| `estado` | `string` | Sí |
| `fechaAprob` | `ISODate` | No |
| `fechaPago` | `ISODate` | No |
| `soporte` | `string` | No |
| `date` | `ISODate` | No |
| `val` | `number` | No |
| `ref` | `string` | No |
| `status` | `string` | No |
#### Guarantee

| Campo | Tipo frontend | Obligatorio en interfaz |
|---|---|---|
| `id` | `UID` | Sí |
| `contractId` | `UID` | Sí |
| `tipo` | `string` | Sí |
| `aseguradora` | `string` | Sí |
| `poliza` | `string` | Sí |
| `modalidadPoliza` | `'Póliza individual' ∣ 'Póliza por cupo' ∣ string` | No |
| `cupoId` | `UID ∣ ''` | No |
| `porcentaje` | `number` | No |
| `tomador` | `string` | No |
| `intermediario` | `string` | No |
| `prima` | `number` | No |
| `valor` | `number` | Sí |
| `fechaExp` | `ISODate` | No |
| `fechaInicio` | `ISODate` | Sí |
| `fechaVenc` | `ISODate` | Sí |
| `estado` | `'Pendiente' ∣ 'Aprobada' ∣ 'Rechazada' ∣ 'Anulada' ∣ string` | Sí |
| `documento` | `string` | No |
| `relacion` | `string` | No |
| `num` | `string` | No |
| `issuer` | `string` | No |
| `val` | `number` | No |
| `from` | `ISODate` | No |
| `to` | `ISODate` | No |
| `status` | `string` | No |
| `type` | `string` | No |
#### Cupo

| Campo | Tipo frontend | Obligatorio en interfaz |
|---|---|---|
| `id` | `UID` | Sí |
| `aseguradora` | `string` | Sí |
| `numero` | `string` | Sí |
| `tomador` | `string` | No |
| `intermediario` | `string` | No |
| `valor` | `number` | Sí |
| `fechaInicio` | `ISODate` | Sí |
| `fechaVenc` | `ISODate` | Sí |
| `estado` | `'Vigente' ∣ 'Suspendido' ∣ 'Vencido' ∣ 'Anulado' ∣ string` | Sí |
| `observaciones` | `string` | No |
| `depto` | `string` | No |
| `year` | `number` | No |
| `val` | `number` | No |
| `used` | `number` | No |
#### Acta

| Campo | Tipo frontend | Obligatorio en interfaz |
|---|---|---|
| `id` | `UID` | Sí |
| `contractId` | `UID` | Sí |
| `numero` | `string` | Sí |
| `tipo` | `string` | Sí |
| `fecha` | `ISODate` | Sí |
| `valor` | `number` | No |
| `descripcion` | `string` | Sí |
| `firmantes` | `string` | No |
| `archivo` | `string` | No |
| `responsable` | `string` | No |
| `estado` | `string` | Sí |
| `date` | `ISODate` | No |
| `by` | `UID` | No |
| `status` | `string` | No |
#### Modification

| Campo | Tipo frontend | Obligatorio en interfaz |
|---|---|---|
| `id` | `UID` | Sí |
| `contractId` | `UID` | Sí |
| `numero` | `string` | Sí |
| `tipo` | `string` | Sí |
| `fecha` | `ISODate` | Sí |
| `soporte` | `string` | No |
| `justificacion` | `string` | Sí |
| `valorAnterior` | `number` | No |
| `valorNuevo` | `number` | No |
| `nuevoTexto` | `string` | No |
| `fechaAnterior` | `ISODate` | No |
| `fechaNueva` | `ISODate` | No |
| `impacto` | `string` | No |
| `anulada` | `boolean` | No |
| `date` | `ISODate` | No |
| `valChange` | `number` | No |
| `daysChange` | `number` | No |
| `obs` | `string` | No |
#### Risk

| Campo | Tipo frontend | Obligatorio en interfaz |
|---|---|---|
| `id` | `UID` | Sí |
| `contractId` | `UID` | Sí |
| `categoria` | `string` | No |
| `riesgo` | `string` | No |
| `descripcion` | `string` | No |
| `prob` | `number` | No |
| `probabilidad` | `number` | No |
| `impacto` | `number` | No |
| `responsable` | `string` | No |
| `tratamiento` | `string` | No |
| `fecha` | `ISODate` | No |
| `estado` | `'Abierto' ∣ 'Controlado' ∣ 'Cerrado' ∣ 'Mitigado' ∣ string` | Sí |
| `mitigacion` | `string` | No |
| `evidencia` | `string` | No |
| `nivel` | `number` | No |
| `type` | `string` | No |
| `score` | `number` | No |
| `status` | `string` | No |
| `mitig` | `string` | No |
#### Breach

| Campo | Tipo frontend | Obligatorio en interfaz |
|---|---|---|
| `id` | `UID` | Sí |
| `contractId` | `UID` | Sí |
| `fecha` | `ISODate` | Sí |
| `obligationId` | `UID` | No |
| `tipo` | `string` | Sí |
| `descripcion` | `string` | Sí |
| `responsable` | `string` | No |
| `impacto` | `'Bajo' ∣ 'Medio' ∣ 'Alto' ∣ string` | Sí |
| `estado` | `'Abierto' ∣ 'En análisis' ∣ 'En gestión' ∣ 'Subsanado' ∣ 'Cerrado' ∣ string` | Sí |
| `plan` | `string` | No |
| `planAccion` | `string` | No |
| `fechaLimite` | `ISODate` | No |
| `medida` | `string` | No |
| `multa` | `number` | No |
| `evidencia` | `string` | No |
| `date` | `ISODate` | No |
| `desc` | `string` | No |
| `severity` | `string` | No |
| `status` | `string` | No |
| `penalty` | `number` | No |
#### Plan

| Campo | Tipo frontend | Obligatorio en interfaz |
|---|---|---|
| `id` | `UID` | Sí |
| `contractId` | `UID` | Sí |
| `fecha` | `ISODate` | No |
| `fechaInicio` | `ISODate` | No |
| `fechaFin` | `ISODate` | No |
| `fechaCompromiso` | `ISODate` | No |
| `hallazgo` | `string` | No |
| `causa` | `string` | No |
| `accion` | `string` | Sí |
| `responsable` | `string` | No |
| `estado` | `'Abierto' ∣ 'En ejecución' ∣ 'En curso' ∣ 'Cumplido' ∣ 'Incumplido' ∣ 'Cerrado' ∣ string` | Sí |
| `avance` | `number` | Sí |
| `evidencia` | `string` | No |
| `title` | `string` | No |
| `due` | `ISODate` | No |
| `status` | `string` | No |
| `pct` | `number` | No |
#### DocumentVersion

| Campo | Tipo frontend | Obligatorio en interfaz |
|---|---|---|
| `v` | `number` | Sí |
| `fecha` | `ISODate` | Sí |
| `usuario` | `string` | Sí |
| `archivo` | `string` | Sí |
| `motivo` | `string` | No |
| `cambios` | `string` | No |
| `id` | `UID` | No |
| `docId` | `UID` | No |
| `version` | `number` | No |
| `date` | `ISODate` | No |
| `by` | `UID` | No |
#### Document

| Campo | Tipo frontend | Obligatorio en interfaz |
|---|---|---|
| `id` | `UID` | Sí |
| `contractId` | `UID` | Sí |
| `nombre` | `string` | Sí |
| `categoria` | `string` | Sí |
| `estado` | `string` | Sí |
| `obs` | `string` | No |
| `versions` | `DocumentVersion[]` | Sí |
| `extracted` | `{ valor?: number; plazo?: number; fechaInicio?: ISODate; fechaFin?: ISODate; contratista?: string; nit?: string; objeto?: string; garantias?: string; }` | No |
| `name` | `string` | No |
| `type` | `string` | No |
| `date` | `ISODate` | No |
| `size` | `number` | No |
| `url` | `string` | No |
#### AuditEntry

| Campo | Tipo frontend | Obligatorio en interfaz |
|---|---|---|
| `id` | `UID` | Sí |
| `ts` | `string` | Sí |
| `fecha` | `ISODate` | Sí |
| `hora` | `string` | Sí |
| `usuario` | `string` | Sí |
| `rol` | `string` | Sí |
| `contractId` | `UID` | No |
| `modulo` | `string` | Sí |
| `accion` | `string` | Sí |
| `campo` | `string` | No |
| `anterior` | `any` | No |
| `nuevo` | `any` | No |
| `ip` | `string` | No |
| `obs` | `string` | No |
| `user` | `UID` | No |
| `module` | `string` | No |
| `action` | `string` | No |
| `field` | `string` | No |
| `entity` | `string` | No |
| `entityId` | `UID` | No |
| `details` | `string` | No |
| `date` | `ISODate` | No |
#### Task

| Campo | Tipo frontend | Obligatorio en interfaz |
|---|---|---|
| `id` | `UID` | Sí |
| `titulo` | `string` | Sí |
| `asignado` | `string` | Sí |
| `vence` | `ISODate` | Sí |
| `contractId` | `UID` | No |
| `alertKey` | `string` | No |
| `estado` | `'Pendiente' ∣ 'En progreso' ∣ 'Completada' ∣ string` | Sí |
| `creada` | `string` | No |
| `creadaPor` | `string` | No |
| `user` | `UID` | No |
| `title` | `string` | No |
| `due` | `ISODate` | No |
| `status` | `string` | No |
#### AlertStateItem

| Campo | Tipo frontend | Obligatorio en interfaz |
|---|---|---|
| `estado` | `'Nueva' ∣ 'Leída' ∣ 'Delegada' ∣ 'Resuelta' ∣ string` | No |
| `delegadoA` | `string` | No |
| `nota` | `string` | No |
| `usuario` | `string` | No |
| `fechaGestion` | `string` | No |
| `id` | `UID` | No |
| `read` | `boolean` | No |
#### Settings

| Campo | Tipo frontend | Obligatorio en interfaz |
|---|---|---|
| `currentUser` | `UID` | Sí |
| `alertDays` | `number[]` | Sí |
| `criticalDays` | `number` | Sí |
| `budgetPct` | `number` | Sí |
| `gapPct` | `number` | Sí |
| `perms` | `Record<string, Record<string, boolean ∣ number>>` | Sí |
| `catalogs` | `Record<string, string[]>` | Sí |
| `theme` | `string` | No |
| `notify` | `boolean` | No |
#### DB

| Campo | Tipo frontend | Obligatorio en interfaz |
|---|---|---|
| `version` | `string` | Sí |
| `created` | `string` | Sí |
| `alertState` | `AlertState` | Sí |
| `tasks` | `Task[]` | Sí |
| `audit` | `AuditEntry[]` | Sí |
| `users` | `User[]` | Sí |
| `settings` | `Settings` | Sí |
| `companies` | `Company[]` | Sí |
| `contracts` | `Contract[]` | Sí |
| `subcontracts` | `SubContract[]` | Sí |
| `execs` | `Exec[]` | Sí |
| `payments` | `Payment[]` | Sí |
| `obligations` | `Obligation[]` | Sí |
| `deliverables` | `Deliverable[]` | Sí |
| `guarantees` | `Guarantee[]` | Sí |
| `actas` | `Acta[]` | Sí |
| `modifications` | `Modification[]` | Sí |
| `risks` | `Risk[]` | Sí |
| `breaches` | `Breach[]` | Sí |
| `plans` | `Plan[]` | Sí |
| `documents` | `Document[]` | Sí |
| `cupos` | `Cupo[]` | Sí |
| `documentVersions` | `DocumentVersion[]` | No |
| `audits` | `AuditEntry[]` | No |
#### CMetrics

| Campo | Tipo frontend | Obligatorio en interfaz |
|---|---|---|
| `valorInicial` | `number` | Sí |
| `valorActual` | `number` | Sí |
| `ejecutado` | `number` | Sí |
| `pagado` | `number` | Sí |
| `pendientePago` | `number` | Sí |
| `saldo` | `number` | Sí |
| `pctFin` | `number` | Sí |
| `pctFis` | `number` | Sí |
| `duracion` | `number` | Sí |
| `meses` | `number` | Sí |
| `transcurridos` | `number` | Sí |
| `restantes` | `number ∣ null` | Sí |
| `pctTiempo` | `number` | Sí |
| `estado` | `string` | Sí |
| `activo` | `boolean` | Sí |
| `estadoTemporal` | `string` | Sí |
| `oblTotal` | `number` | Sí |
| `oblCumplidas` | `number` | Sí |
| `oblVencidas` | `number` | Sí |
| `pctCumpl` | `number` | Sí |
| `entVencidos` | `number` | Sí |
| `incAbiertos` | `number` | Sí |
| `garTotal` | `number` | Sí |
| `garVencidas` | `number` | Sí |
| `garMinDias` | `number ∣ null` | Sí |
| `riesgosAltos` | `number` | Sí |
| `riesgosTotal` | `number` | Sí |
| `docsFaltantes` | `string[]` | Sí |
| `docs` | `number` | Sí |
| `subs` | `number` | Sí |
| `promMensual` | `number` | Sí |
| `mesesAgotar` | `number ∣ null` | Sí |
| `fechaAgotar` | `string ∣ null` | Sí |
| `agotaAntes` | `boolean` | Sí |
| `pctSaldo` | `number` | Sí |
| `nivel` | `'ok' ∣ 'warn' ∣ 'risk' ∣ 'crit' ∣ 'na'` | Sí |
| `razones` | `Array<{ l: string; t: string }>` | Sí |
| `score` | `{ total: number; comps: Record<string, number> }` | Sí |
| `sem` | `string` | Sí |
| `level` | `number` | Sí |
| `valAct` | `number` | Sí |
| `valBase` | `number` | Sí |
| `saldoRest` | `number` | No |
| `pExecFin` | `number` | Sí |
| `pExecFis` | `number` | Sí |
| `daysLeft` | `number` | Sí |
#### VIssue

| Campo | Tipo frontend | Obligatorio en interfaz |
|---|---|---|
| `area` | `string` | No |
| `sev` | `'Alta' ∣ 'Media' ∣ 'Baja' ∣ string` | Sí |
| `campo` | `string` | No |
| `actual` | `string ∣ number` | No |
| `esperado` | `string ∣ number` | No |
| `msg` | `string` | Sí |
| `rec` | `string` | No |
#### Alert

| Campo | Tipo frontend | Obligatorio en interfaz |
|---|---|---|
| `key` | `string` | Sí |
| `nivel` | `'critica' ∣ 'riesgo' ∣ 'proxima' ∣ 'info'` | Sí |
| `tipo` | `string` | Sí |
| `contractId` | `string ∣ null` | Sí |
| `numero` | `string` | Sí |
| `descripcion` | `string` | Sí |
| `fecha` | `string` | Sí |
| `responsable` | `string` | Sí |
| `act` | `string` | Sí |
| `estado` | `string` | Sí |
| `delegadoA` | `string` | No |
| `gestion` | `AlertStateItem` | No |

### 3.2 Relaciones y límites del modelo

| Relación | Evidencia frontend | Correspondencia API / condición | Estado |
|---|---|---|---|
| Company 1:N Contract | Contract.companyId, company alias | companies → contracts.company_id | [CONFIRMADO por frontend]; físico [INFERIDO razonable] |
| Contract 1:N cada colección hija | contractId en SubContract, Obligation, Deliverable, Exec, Payment, Guarantee, Acta, Modification, Risk, Breach, Plan, Document | Las doce colecciones existen; se deben validar pertenencia y contrato no anulado | [CONFIRMADO por frontend]; invariantes [INFERIDO razonable] |
| Contract → Contract padre opcional | parentId en tipo | No aparece en CrearContratoDto; subcontracts es el modelo operativo visible | [CONFIRMADO por frontend]; uso efectivo [REQUIERE VALIDACION DE NEGOCIO] |
| Deliverable → Obligation opcional | obligId alias | No existe en DTO/entidad Deliverable leídos; no suponer FK | [CONFIRMADO por frontend]; relación persistida [REQUIERE VALIDACION DE NEGOCIO] |
| Breach → Obligation opcional | obligationId | obligations y breaches existen; debe comprobarse mismo contractId | [CONFIRMADO por frontend]; validación [INFERIDO razonable] |
| Plan → Breach | No breachId: hallazgo/cadena plan o planAccion en Breach | No relación física explícita observada; ambas cuelgan del contrato | [REQUIERE VALIDACION DE NEGOCIO] |
| Guarantee → Cupo opcional | modalidadPoliza y cupoId | Póliza individual o por cupo; cupo debe pertenecer a misma aseguradora | [CONFIRMADO por frontend]; servidor [INFERIDO razonable] |
| Aseguradora / tomador / intermediario | Cadenas en Guarantee/Cupo y catálogo | No entidad insurers; GET insurers calcula agrupaciones | [CONFIRMADO por frontend]; crear maestros adicionales [REQUIERE VALIDACION DE NEGOCIO] |
| Contratista / cliente | nombre y NIT dentro de Contract; cliente mapa deduplicado por NIT | Company es empresa contratante; no confundir con todos los contratistas | [CONFIRMADO por frontend]; maestro de terceros [REQUIERE VALIDACION DE NEGOCIO] |
| Document 1:N DocumentVersion | versions[]; v número documental | document_versions.document_id; document.version es bloqueo optimista diferente | [CONFIRMADO por frontend]; físico [INFERIDO razonable] |
| Obligation 1:N checklist/comentarios/evidencias | Arrays anidados | obligation_checklist/comments/evidences tablas separadas | [CONFIRMADO por frontend]; físico [INFERIDO razonable] |
| Task → Alert / Contract / User | alertKey, contractId y asignado libre (nombre en formulario) | alert_key estable y users.id en API; creadaPor también cambia nombre→ID | [CONFIRMADO por frontend]; normalización [INFERIDO razonable] |
| Alert → estado de gestión | AlertState indexado por clave, estado/delegado/nota | alert_state y alert_keys; alerta es proyección calculada | [CONFIRMADO por frontend]; físico [INFERIDO razonable] |
| Contract → departamentos N:M conceptual | deptos[]; fallback geográfico 08 en mapa | JSONB, no tabla contract_departments observada | [CONFIRMADO por frontend]; reparto de valor multicobertura [REQUIERE VALIDACION DE NEGOCIO] |
| Settings → roles/catálogos | matriz y Record de valores dentro del DB local | settings, role_permissions, catalogs, catalog_items | [CONFIRMADO por frontend]; físico [INFERIDO razonable] |
| AuditEntry → usuario/contrato | usuario/rol como texto, contractId opcional | audit_log INSERT-only y hash servidor; front solo Object.freeze/IP simulada | [CONFIRMADO por frontend]; seguridad servidor [INFERIDO razonable] |

### 3.3 Mock, catálogos y estados

`lib/demo.ts` genera fechas relativas a hoy y `DB.version='2.0'`; no es versionado de registros. `Seed.build()` crea ocho usuarios (uno por rol), empresas, contratos y colecciones relacionadas; `Store.init()` conserva un DB local que puede diferir del seed. No se consultó ni alteró el localStorage del usuario. Los nombres, NIT, aseguradoras y números demo son ejemplos, no requisitos de negocio. Los mocks incluyen condiciones deliberadamente inconsistentes para activar validaciones y alertas. [CONFIRMADO por frontend].

Default settings del seed: alertDays=[30,15,10,5,3,1], criticalDays=5, budgetPct=15, gapPct=20. ConfiguracionView usa fallback gapPct=15 si faltan settings; estas discrepancias no establecen una nueva regla. CAT(key) devuelve defaultCatalogs y no settings.catalogs; el mapa sí usa settings.catalogs. Por tanto, editar catálogos en configuración no actualiza todas las opciones del front. [CONFIRMADO por frontend]; autoridad definitiva [REQUIERE VALIDACION DE NEGOCIO].

Catálogos completos de `lib/catalog.ts`:

- `tiposContrato`: Prestación de servicios; Prestación de servicios de salud; Obra civil; Suministro; Consultoría; Interventoría; Mantenimiento; Arrendamiento; Transporte; Tecnología y licenciamiento; Compraventa; Otro. [CONFIRMADO por frontend].
- `modalidades`: Contratación directa; Invitación privada; Invitación pública; Convocatoria abierta; Orden de compra; Otra. [CONFIRMADO por frontend].
- `estados`: Borrador; Activo; Suspendido; Terminado; En liquidación; Liquidado; Anulado. [CONFIRMADO por frontend].
- `tiposGarantia`: Cumplimiento; Calidad; Responsabilidad civil; Salarios y prestaciones; Manejo de anticipo; Estabilidad; Seriedad de la oferta; Todo riesgo; Responsabilidad civil profesional; Otros. [CONFIRMADO por frontend].
- `aseguradoras`: Seguros del Estado S.A.; Seguros Generales Suramericana (SURA); Seguros Bolívar S.A.; Mundial de Seguros S.A.; Liberty Seguros S.A.; Mapfre Seguros Generales; Allianz Seguros S.A.; AXA Colpatria Seguros; La Previsora S.A.; Chubb Seguros Colombia; Aseguradora Solidaria de Colombia; SBS Seguros Colombia; HDI Seguros; Zurich Colombia Seguros; Confianza (Compañía Aseguradora de Fianzas). [CONFIRMADO por frontend].
- `tiposActa`: Acta de inicio; Acta parcial; Acta de suspensión; Acta de reinicio; Acta de modificación; Acta de recibo; Acta de terminación; Acta de liquidación. [CONFIRMADO por frontend].
- `tiposObligacion`: General; Específica; Financiera; Técnica; Legal; Reporte / informe; Seguridad social; Calidad. [CONFIRMADO por frontend].
- `categoriasRiesgo`: Financiero; Operativo; Legal / regulatorio; Técnico; Cumplimiento; Reputacional; Seguridad de la información; Proveedor. [CONFIRMADO por frontend].
- `categoriasDoc`: Contrato; Estudios previos; Propuesta; Garantías; Actas; Facturas; Informes; Evidencias; Modificaciones; Prórrogas; Suspensiones; Liquidación; Otros. [CONFIRMADO por frontend].
- `docsRequeridos`: Contrato; Propuesta; Garantías; Actas. [CONFIRMADO por frontend].
- `areas`: Jurídica; Financiera; Compras; Operaciones; Tecnología; Salud; Gerencia; Talento humano. [CONFIRMADO por frontend].

Los campos estado son strings amplios en frontend (muchos unions terminan en string), pero el DTO backend usa listas cerradas. Estados efectivo Vencido/Vencida se derivan de fecha en M/effOblig/effDeliv; no siempre están en el estado almacenado ni en los enums editables. Riesgo nivel se deriva P×I: <5 Bajo, 5–9 Moderado, 10–14 Alto, ≥15 Extremo. La matriz riesgo y las seis regiones/33 unidades DANE (incluido Bogotá) son referencia geográfica, no tablas de negocio adicionales confirmadas. [CONFIRMADO por frontend].

### 3.4 Tablas existentes en backend

28 tablas verificadas en decorators Entity; contrastadas con migración inicial. El siguiente mapeo evita proponer tablas duplicadas. [INFERIDO razonable] como correspondencia con necesidades frontend; nombres existentes confirmados por código backend.

| Tabla | Entidad TypeORM | Campos de persistencia relevantes | Fuente |
|---|---|---|---|
| `alert_state` | AlertStateEntity | `alertKey`, `estado`, `delegadoA`, `nota`, `usuario`, `fechaGestion` | `src/modules/alerts/alerts.entity.ts` |
| `alert_keys` | AlertKeyEntity | `alertKey`, `tipo`, `contractId`, `primeraVez` | `src/modules/alerts/alerts.entity.ts` |
| `tasks` | TaskEntity | `id`, `titulo`, `asignado`, `vence`, `contractId`, `alertKey`, `estado`, `creadaPor`, `version`, `createdAt`, `updatedAt` | `src/modules/alerts/alerts.entity.ts` |
| `audit_log` | AuditLogEntity | `id`, `ts`, `fecha`, `hora`, `usuario`, `rol`, `contractId`, `modulo`, `accion`, `campo`, `anterior`, `nuevo`, `ip`, `obs`, `hash` | `src/modules/audit/audit.entity.ts` |
| `companies` | CompanyEntity | `id`, `razon`, `nit`, `tipo`, `direccion`, `ciudad`, `depto`, `pais`, `rep`, `repDoc`, `tel`, `email`, `respInterno`, `estado`, `fechaCreacion`, `motivoAnulacion`, `version`, `createdAt`, `updatedAt` | `src/modules/companies/companies.entity.ts` |
| `actas` | ActaEntity | `id`, `contractId`, `numero`, `tipo`, `fecha`, `valor`, `descripcion`, `archivo`, `responsable`, `estado`, `motivoAnulacion`, `version`, `createdAt`, `updatedAt` | `src/modules/contracts/entities/actas.entity.ts` |
| `breaches` | BreachEntity | `id`, `contractId`, `fecha`, `obligationId`, `tipo`, `descripcion`, `responsable`, `impacto`, `estado`, `plan`, `fechaLimite`, `medida`, `multa`, `evidencia`, `motivoAnulacion`, `version`, `createdAt`, `updatedAt` | `src/modules/contracts/entities/breaches.entity.ts` |
| `contracts` | ContractEntity | `id`, `numero`, `tipo`, `modalidad`, `companyId`, `estado`, `contratista`, `nitContratista`, `repContratista`, `area`, `objeto`, `descripcion`, `responsable`, `supervisor`, `interventor`, `deptos`, `municipio`, `fechaFirma`, `fechaInicio`, `fechaFin`, `hastaAgotar`, `valorBase`, `iva`, `otrosImp`, `adiciones`, `reducciones`, `avanceFisico`, `alcance`, `productos`, `indicadores`, `anulado`, `motivoAnulacion`, `version`, `createdAt`, `updatedAt` | `src/modules/contracts/entities/contract.entity.ts` |
| `deliverables` | DeliverableEntity | `id`, `contractId`, `nombre`, `descripcion`, `fechaInicio`, `fechaProg`, `fechaReal`, `responsable`, `estado`, `avance`, `evidencia`, `obs`, `motivoAnulacion`, `version`, `createdAt`, `updatedAt` | `src/modules/contracts/entities/deliverables.entity.ts` |
| `documents` | DocumentEntity | `id`, `contractId`, `nombre`, `categoria`, `estado`, `obs`, `extracted`, `motivoAnulacion`, `version`, `createdAt`, `updatedAt` | `src/modules/contracts/entities/documents.entity.ts` |
| `document_versions` | DocumentVersionEntity | `id`, `documentId`, `v`, `fecha`, `usuario`, `archivo`, `motivo`, `cambios`, `createdAt` | `src/modules/contracts/entities/documents.entity.ts` |
| `execs` | ExecEntity | `id`, `contractId`, `periodo`, `valor`, `avanceFisico`, `obs`, `motivoAnulacion`, `version`, `createdAt`, `updatedAt` | `src/modules/contracts/entities/execs.entity.ts` |
| `guarantees` | GuaranteeEntity | `id`, `contractId`, `tipo`, `aseguradora`, `poliza`, `modalidadPoliza`, `cupoId`, `porcentaje`, `tomador`, `intermediario`, `prima`, `valor`, `fechaExp`, `fechaInicio`, `fechaVenc`, `estado`, `documento`, `relacion`, `motivoAnulacion`, `version`, `createdAt`, `updatedAt` | `src/modules/contracts/entities/guarantees.entity.ts` |
| `modifications` | ModificationEntity | `id`, `contractId`, `numero`, `tipo`, `fecha`, `soporte`, `justificacion`, `valorAnterior`, `valorNuevo`, `nuevoTexto`, `fechaAnterior`, `fechaNueva`, `impacto`, `estado`, `motivoAnulacion`, `version`, `createdAt`, `updatedAt` | `src/modules/contracts/entities/modifications.entity.ts` |
| `obligations` | ObligationEntity | `id`, `contractId`, `tipo`, `descripcion`, `responsable`, `fechaLimite`, `periodicidad`, `evidencia`, `estado`, `cumplimiento`, `obs`, `motivoAnulacion`, `version`, `createdAt`, `updatedAt` | `src/modules/contracts/entities/obligations.entity.ts` |
| `obligation_checklist` | ObligationChecklistEntity | `id`, `obligationId`, `texto`, `hecho`, `orden`, `createdAt` | `src/modules/contracts/entities/obligations.entity.ts` |
| `obligation_comments` | ObligationCommentEntity | `id`, `obligationId`, `usuario`, `texto`, `createdAt` | `src/modules/contracts/entities/obligations.entity.ts` |
| `obligation_evidences` | ObligationEvidenceEntity | `id`, `obligationId`, `nombre`, `archivo`, `usuario`, `createdAt` | `src/modules/contracts/entities/obligations.entity.ts` |
| `payments` | PaymentEntity | `id`, `contractId`, `numero`, `fecha`, `factura`, `periodo`, `bruto`, `iva`, `retenciones`, `neto`, `estado`, `fechaAprob`, `fechaPago`, `soporte`, `motivoAnulacion`, `version`, `createdAt`, `updatedAt` | `src/modules/contracts/entities/payments.entity.ts` |
| `plans` | PlanEntity | `id`, `contractId`, `fecha`, `hallazgo`, `causa`, `accion`, `responsable`, `estado`, `avance`, `evidencia`, `motivoAnulacion`, `version`, `createdAt`, `updatedAt` | `src/modules/contracts/entities/plans.entity.ts` |
| `cupos` | CupoEntity | `id`, `aseguradora`, `numero`, `tomador`, `intermediario`, `valor`, `fechaInicio`, `fechaVenc`, `estado`, `observaciones`, `motivoAnulacion`, `version`, `createdAt`, `updatedAt` | `src/modules/contracts/entities/quotas.entity.ts` |
| `risks` | RiskEntity | `id`, `contractId`, `categoria`, `riesgo`, `prob`, `impacto`, `responsable`, `tratamiento`, `fecha`, `estado`, `mitigacion`, `evidencia`, `motivoAnulacion`, `version`, `createdAt`, `updatedAt` | `src/modules/contracts/entities/risks.entity.ts` |
| `subcontracts` | SubcontractEntity | `id`, `contractId`, `numero`, `contratista`, `nit`, `objeto`, `valor`, `fechaInicio`, `fechaFin`, `estado`, `ejecucion`, `responsable`, `documentos`, `riesgos`, `obligaciones`, `motivoAnulacion`, `version`, `createdAt`, `updatedAt` | `src/modules/contracts/entities/subcontracts.entity.ts` |
| `role_permissions` | RolePermissionEntity | `id`, `rol`, `permiso`, `habilitado` | `src/modules/roles/roles.entity.ts` |
| `settings` | SettingEntity | `id`, `alertDays`, `criticalDays`, `budgetPct`, `gapPct`, `updatedAt` | `src/modules/settings/settings.entity.ts` |
| `catalogs` | CatalogEntity | `nombre`, `createdAt`, `updatedAt` | `src/modules/settings/settings.entity.ts` |
| `catalog_items` | CatalogItemEntity | `id`, `catalogNombre`, `valor`, `orden` | `src/modules/settings/settings.entity.ts` |
| `users` | UserEntity | `id`, `nombre`, `email`, `rol`, `estado`, `motivoAnulacion`, `version`, `createdAt`, `updatedAt` | `src/modules/users/users.entity.ts` |

## 4. Dashboards, mapa y reportes: métricas, gráficos, filtros y periodos exactos

### 4.1 Convenciones de cálculo observadas

[CONFIRMADO por frontend]. Fuentes: `lib/metrics.ts`, `lib/format.ts`, `components/views/DashboardView.tsx`, `GerenciaView.tsx`, `components/mapa/MapaColombia.tsx` y `components/reportes/catalogo.ts`.

- **Universo contractual de portfolio**: `activeContracts()` significa todos los contratos distintos de Anulado; incluye Borrador, Terminado y Liquidado. No equivale a contratos Activo.
- **Valor inicial** = valorBase + iva + otrosImp. **Valor actualizado** = inicial + adiciones − reducciones. **Ejecutado** = suma de registros de ejecución. **Pagado** = suma bruto + iva de pagos con estado Pagado; no resta retenciones. **Saldo** = actualizado − ejecutado. **% financiero** = ejecutado / actualizado × 100, con tratamiento de denominador cero en el motor.
- **% físico** procede de `Contract.avanceFisico`; registrar `Execution.avance` no sincroniza este campo. El financiero agregado divide totales; el físico agregado pondera por valor actualizado.
- **Plazo** = diferencia entre inicio y fin + 1 día. **Días restantes** = diferencia entre hoy y fin; ausencia de fecha produce null en el frontend. Estado efectivo Vencido deriva de Activo con fin anterior a hoy.
- **Promedio de ejecución**: sumar por periodo y promediar los últimos tres periodos distintos disponibles; no completar meses ausentes con cero. **Agotamiento**: hoy + redondeo(saldo / promedio × 30,4) días; saldo no positivo produce hoy.
- **Riesgo**: probabilidad × impacto; Bajo <5, Moderado 5..9, Alto 10..14, Extremo ≥15. Los alias `probabilidad/prob` requieren normalización uniforme.
- **Obligación efectiva**: Pendiente/En proceso con fecha límite pasada se presenta Vencida. Cumplimiento agregado promedia porcentajes. Entregables atrasados excluyen Aprobado/Entregado/Suspendido y los que tienen fechaReal.
- **Semáforo**: peor severidad encontrada; Anulado o datos esenciales incompletos → sin información, Liquidado → normal. Contrato vencido, ejecución >100%, póliza aprobada vencida y ≥3 obligaciones vencidas elevan a crítico. Plazo ≤criticalDays → crítico; ≤15 → riesgo; ≤30 → atención. Saldo porcentual bajo usa budgetPct; agotamiento, brecha absoluta financiero/físico >gapPct, riesgos altos, entregables atrasados, documentos faltantes y suspensión participan. Incumplimientos abiertos elevan a riesgo. Es una política del prototipo, no una regla legal aprobada.
- **ControlScore**, máximo 100: documentación 20%, obligaciones 20%, ejecución 15%, soporte de pagos 10%, garantías 15%, mitigación de riesgos 10%, auditoría 10%. Documentación mide presencia de categorías requeridas; obligaciones sin datos puntúan 50; ejecución sin registros 30, >100% financiero 40, resto 100 − min(60, brecha absoluta); pagos sin registros 60; garantías sin registros 0; riesgos sin registros 40; auditoría con ≥2 entradas 100 y en otro caso 60. El frontend muestra componentes además del total.

[REQUIERE VALIDACION DE NEGOCIO]. Deben acordarse significado de pagado frente a neto desembolsado, medida física autoritativa, inclusiones por estado, umbrales y ponderaciones; el backend no debe consolidar estas decisiones como legislación.

### 4.2 Dashboard /dashboard: 14 KPIs

| Etiqueta exacta | Cálculo / universo | Periodo | Estado |
|---|---|---|---|
| Total contratos | P.n; contratos no anulados | Acumulado al corte | [CONFIRMADO por frontend] |
| Contratos activos | P.act; estado efectivo Activo | Hoy | [CONFIRMADO por frontend] |
| Próximos a vencer | P.prox; activos con ≤30 días restantes | Hoy a +30 días | [CONFIRMADO por frontend] |
| Contratos vencidos | P.venc; estado efectivo Vencido | Hoy | [CONFIRMADO por frontend] |
| Suspendidos | P.susp | Corte actual | [CONFIRMADO por frontend] |
| En liquidación | P.liq | Corte actual | [CONFIRMADO por frontend] |
| Valor contratado | Σ valor actualizado | Acumulado | [CONFIRMADO por frontend] |
| Valor ejecutado | Σ ejecución contractual | Acumulado | [CONFIRMADO por frontend] |
| Saldo contractual | Σ actualizado − Σ ejecutado | Acumulado | [CONFIRMADO por frontend] |
| % Ejecución financiera | Σ ejecutado / Σ actualizado ×100 | Acumulado | [CONFIRMADO por frontend] |
| % Ejecución contractual | Σ físico × valor actualizado / Σ valor actualizado | Corte actual | [CONFIRMADO por frontend] |
| Con alertas activas | P.conAlerta; implementación consulta claves de alertState por ID contractual, no motor de alertas | Corte actual; cálculo defectuoso | [CONFIRMADO por frontend] |
| Con incumplimientos | Número de contratos con incumplimientos abiertos; no cantidad de casos | Corte actual | [CONFIRMADO por frontend] |
| Garantías por vencer | Pólizas aprobadas a 0..30 días, contrato no anulado ni cerrado | Hoy a +30 días | [CONFIRMADO por frontend] |

| Gráfico | Series, ejes y universo | Periodo / detalle | Estado |
|---|---|---|---|
| Doughnut de semáforo | Normal, Atención, Riesgo, Crítico, Sin información; número de contratos del portfolio | Corte actual | [CONFIRMADO por frontend] |
| Doughnut por estado contractual | Estado efectivo del contrato; conteos del portfolio | Corte actual | [CONFIRMADO por frontend] |
| Barras horizontales por empresa | Empresa frente a número de contratos | Todo el portfolio | [CONFIRMADO por frontend] |
| Barras de vencimientos | Hoy, 1–5, 6–15, 16–30, 31–60, Vencidos; contratos Activo/Vencido | Ventanas relativas a hoy | [CONFIRMADO por frontend] |
| Barras valor contratado vs ejecutado | 7 contratos con mayor valor actualizado; dos series; eje monetario logarítmico | Acumulado | [CONFIRMADO por frontend] |
| Línea ejecución y pagos mensuales | Σ ejecución por periodo, Σ bruto+iva de Pagado por mes; ejecución excluye padre anulado, pagos no aplican ese filtro | 12 meses calendario incluyendo el actual; ceros finales de cada serie se sustituyen por null, spanGaps | [CONFIRMADO por frontend] |
| Barras apiladas de riesgos | Bajo, Moderado, Alto, Extremo; Abiertos y Controlados, excluye Cerrado | Todos los riesgos; sin excluir contrato anulado | [CONFIRMADO por frontend] |
| Doughnut de obligaciones | Cumplida, Cumplida parcialmente, En proceso, Pendiente, Vencida, Incumplida; estado efectivo | Todos los registros salvo padre anulado | [CONFIRMADO por frontend] |

**Panel de tareas de atención**, nueve grupos observados: vencimiento de contratos activos dentro de criticalDays; contratos vencidos; ejecución financiera >100%; obligaciones vencidas/incumplidas de padre válido; garantías aprobadas a ≤15 días de contratos no cerrados; pagos Pendiente/En revisión; brecha financiera − física >gapPct en activos; incumplimientos abiertos; documentos faltantes de contratos no Liquidado. Cada grupo ofrece conteo y navegación al módulo correspondiente. Algunos grupos incluyen registros de padres anulados; no asumir un universo homogéneo.

**Tarjetas próximas a vencer**: contratos activos a 0..15 días, ordenados por días restantes; muestran obligaciones pendientes y ofrecen expediente, prórroga, modificaciones/terminación y obligaciones. Umbral crítico configurable. **No hay selector global de fecha, año, empresa o periodo para todos los KPIs/gráficos**; los filtros del mapa son independientes.

[INFERIDO razonable]. Endpoint agregado propuesto `GET /api/dashboard`, con corte explícito y universo documentado, o composición de colecciones existentes; no está expuesto actualmente. Permiso de lectura VER. Tablas: contracts, companies, execs, payments, obligations, guarantees, risks, breaches, documents, audit_log y configuración. Cache agregado dependiente de mutaciones y cambio de día; debe variar por acceso y corte.

### 4.3 Gerencia /gerencia: 8 KPIs y 3 gráficos

| Etiqueta / contenido | Fórmula exacta observada | Periodo | Estado |
|---|---|---|---|
| Total contratos | P.n; acompañamiento P.act activos | Corte | [CONFIRMADO por frontend] |
| Valor administrado | P.valor actualizado | Acumulado | [CONFIRMADO por frontend] |
| Valor ejecutado | P.ejec; acompañamiento P.pctFin | Acumulado | [CONFIRMADO por frontend] |
| Saldo disponible | P.saldo | Acumulado | [CONFIRMADO por frontend] |
| Riesgo contractual | round((críticos×100 + riesgo×60 + atención×25)/P.n); normal y sin información aportan 0 pero quedan en denominador | Corte | [CONFIRMADO por frontend] |
| Vencimientos ≤30 d | P.prox; acompañamiento P.venc vencidos | Hoy a +30 | [CONFIRMADO por frontend] |
| Incumplimientos | Número de casos no Cerrado/Subsanado, incluso de cualquier padre | Corte | [CONFIRMADO por frontend] |
| Obligaciones | Promedio de cumplimiento de todas las obligaciones, sin filtro de padre | Corte | [CONFIRMADO por frontend] |

| Gráfico / tabla | Datos | Periodo / interacción | Estado |
|---|---|---|---|
| Línea ejecución/pagos acumulados | Todas las ejecuciones y pagos Pagado bruto+iva; no filtra padres anulados | 12 meses incluyendo actual; acumulado arranca en cero al inicio de la ventana, no incluye historia previa | [CONFIRMADO por frontend] |
| Doughnut vigencia de garantías | Aprobadas: Vigentes >30 días, por vencer 0..30, vencidas <0 | Hoy; sin filtro de estado del padre | [CONFIRMADO por frontend] |
| Barras por empresa | Valor actualizado y ejecutado de contratos no anulados | Acumulado | [CONFIRMADO por frontend] |
| Tabla de contratos críticos | Nivel de semáforo ≥3 (riesgo/crítico); contrato, empresa, contratista, valor actual, semáforo y razones | Orden severidad descendente y luego valor descendente; abre expediente | [CONFIRMADO por frontend] |

Exportación XLSX/PDF/CSV del conjunto crítico; si está vacío usa todo el portfolio. No hay selector de periodo ni filtros globales. Endpoint agregado gerencial y desglose de score son propuestas [INFERIDO razonable]; validar indicadores con dirección [REQUIERE VALIDACION DE NEGOCIO].

### 4.4 Mapa geográfico: controles, medidas, KPIs y atribución

El mapa vive dentro del dashboard, no añade una página al inventario. [CONFIRMADO por frontend].

| Control / salida | Valores y efecto exacto | Estado |
|---|---|---|
| Métrica | Contratos, Pólizas, Clientes | [CONFIRMADO por frontend] |
| Medida | n = cantidad, v = valor; en Clientes/v muestra valor contratado, no valoración del cliente | [CONFIRMADO por frontend] |
| Aseguradora | Todas o nombre de settings.catalogs; restringe pólizas y contratos pertinentes | [CONFIRMADO por frontend] |
| Estado | Todos; Activos = Activo o Vencido; Suspendido; En liquidación; Liquidado; Terminado | [CONFIRMADO por frontend] |
| Empresa | Todas o companyId | [CONFIRMADO por frontend] |
| Departamento | Selección por código DANE; detalle y enlaces a contratos filtrados por departamento/región | [CONFIRMADO por frontend] |
| Limpiar | Reinicia aseguradora, estado, empresa y selección; conserva métrica y medida | [CONFIRMADO por frontend] |
| KPIs nacionales | Contratos únicos, pólizas únicas, clientes agrupados por NIT; los vacíos comparten clave; departamentos presentes de 33 según métrica seleccionada; región líder y departamento destacado | [CONFIRMADO por frontend] |
| Coropleta | Intensidad relativa al máximo de la métrica: cortes 0,2 / 0,4 / 0,6 / 0,8; no son umbrales de riesgo | [CONFIRMADO por frontend] |
| Tarjetas regionales | Conteos y valores sumados desde departamentos de cada región | [CONFIRMADO por frontend] |
| Detalle departamental | Contratos, pólizas y clientes de ese departamento con navegación a expediente | [CONFIRMADO por frontend] |
| Periodo | Sin filtro temporal; corte de datos disponibles | [CONFIRMADO por frontend] |

Reglas de atribución observadas: contratos no Anulado; pólizas distintas de Anulada/Rechazada; cada departamento asignado recibe **el valor contractual completo y el valor asegurado completo**, no una prorrata. Contratos sin departamentos usan `08` (Atlántico). Un contrato/póliza/cliente presente en dos departamentos puede contarse dos veces al sumar una región en el frontend; totales nacionales sí usan unicidad. El motor API regional deduplica: ambos resultados divergen para registros multidepartamento.

[REQUIERE VALIDACION DE NEGOCIO]. Validar departamento por defecto, regla de atribución y agregación, identidad del cliente y tratamiento de NIT vacío, si la métrica Clientes/v debe llamarse valor de contratos de clientes, y tratamiento de rechazadas/contratos cerrados. No crear entidad Cliente por la mera existencia de esa etiqueta: el mock lo deriva de contratista/NIT.

API existente: `GET /api/geo/departments` y `GET /api/geo/regions`; adaptar nombres de estado y DTO de salida. Cache por todos los filtros, corte y permisos; invalidar con contrato, póliza/cupo y catálogo geográfico. [INFERIDO razonable] para estrategia de cache, no configuración desplegada.

### 4.5 Los 19 reportes r_*: contenido exacto y contrato de integración

La ruta dinámica `/reportes/[reportKey]` admite **19 claves**; se cuenta como una de las 74 páginas, con 19 variantes funcionales revisadas. Índice: búsqueda de título/descripción del reporte. Vista de datos: 15 filas por página, total, exportación XLSX/PDF/CSV e impresión; **sin filtros de datos ni selector de fecha/periodo**. Exporta todas las filas, no solo la página. El corte de próximos/vigencias es hoy. [CONFIRMADO por frontend].

Endpoint existente para todas las claves: `GET /api/reports/{key}`, con formatos JSON/XLSX/PDF. El backend exige EXPORTAR incluso para JSON y añade AUDITAR para r_aud; el frontend permite leer con VER y añade AUDITAR para r_aud. El formato CSV no tiene implementación equivalente: cae en JSON. `columnas/filas` del API requieren adaptarse a `cols/rows` del front. Cache propuesto derivado, sin tabla de reporte, invalidado por entidades indicadas; auditoría requiere corte o lectura fresca y autorización. [INFERIDO razonable] para adaptación/cache; [REQUIERE VALIDACION DE NEGOCIO] para política de acceso.

| Clave y vista | Funcionalidad, universo / periodo | Columnas exactas del frontend | Entidades / tablas | Endpoint / permisos esperados | Cache, riesgos y estado |
|---|---|---|---|---|---|
| `r_general` — Reporte general de contratos | Todos los contratos no anulados; corte actual | Contrato; Empresa; Contratista; Tipo; Modalidad; Objeto; Inicio; Terminación; Días rest.; Valor actualizado; Ejecutado; Saldo; % Fin.; % Fís.; Semáforo; Estado; Responsable | contracts, companies y métricas de hijos | GET /api/reports/r_general; lectura VER; exportar EXPORTAR | Derivado de entidades; revisar alcance, columnas y permisos. Contenido [CONFIRMADO por frontend]; cache [INFERIDO razonable]; semántica [REQUIERE VALIDACION DE NEGOCIO] |
| `r_empresa` — Contratos por empresa | Agrupa portfolio por empresa; orden por valor descendente | Empresa; Contratos; Activos; En riesgo / críticos; Valor actualizado; Ejecutado; Saldo; % ejecución | contracts, companies, execs | GET /api/reports/r_empresa; lectura VER; exportar EXPORTAR | Derivado de entidades; revisar alcance, columnas y permisos. Contenido [CONFIRMADO por frontend]; cache [INFERIDO razonable]; semántica [REQUIERE VALIDACION DE NEGOCIO] |
| `r_estado` — Contratos por estado | Agrupa portfolio por estado efectivo | Estado; Contratos; Activos; En riesgo / críticos; Valor actualizado; Ejecutado; Saldo; % ejecución | contracts, execs | GET /api/reports/r_estado; lectura VER; exportar EXPORTAR | Derivado de entidades; revisar alcance, columnas y permisos. Contenido [CONFIRMADO por frontend]; cache [INFERIDO razonable]; semántica [REQUIERE VALIDACION DE NEGOCIO] |
| `r_anio` — Contratos por año | Agrupa por año de firma o inicio; fallback sin fecha | Año; Contratos; Activos; En riesgo / críticos; Valor actualizado; Ejecutado; Saldo; % ejecución | contracts, execs | GET /api/reports/r_anio; lectura VER; exportar EXPORTAR | Derivado de entidades; revisar alcance, columnas y permisos. Contenido [CONFIRMADO por frontend]; cache [INFERIDO razonable]; semántica [REQUIERE VALIDACION DE NEGOCIO] |
| `r_proximos` — Contratos próximos a vencer | Activo con restantes ≤30 o Vencido; orden días ascendente; incluye vencidos | Contrato; Empresa; Contratista; Objeto; Inicio; Terminación; Días restantes; Estado; Responsable | contracts, companies | GET /api/reports/r_proximos; lectura VER; exportar EXPORTAR | Derivado de entidades; revisar alcance, columnas y permisos. Contenido [CONFIRMADO por frontend]; cache [INFERIDO razonable]; semántica [REQUIERE VALIDACION DE NEGOCIO] |
| `r_fin` — Ejecución financiera | Portfolio no anulado; acumulados financieros y agotamiento proyectado | Contrato; Empresa; Valor inicial; Adiciones; Reducciones; Valor actualizado; Ejecutado; Pagado; Saldo; % ejecución; Agotamiento proyectado | contracts, execs, payments | GET /api/reports/r_fin; lectura VER; exportar EXPORTAR | Derivado de entidades; revisar alcance, columnas y permisos. Contenido [CONFIRMADO por frontend]; cache [INFERIDO razonable]; semántica [REQUIERE VALIDACION DE NEGOCIO] |
| `r_cont` — Ejecución contractual | Portfolio; tiempo, físico, financiero, brecha financiera−física, obligaciones y entregables | Contrato; % tiempo; % físico; % financiero; Brecha fin.-física; % cumpl. oblig.; Oblig. vencidas; Entregables vencidos; Semáforo | contracts, execs, obligations, deliverables | GET /api/reports/r_cont; lectura VER; exportar EXPORTAR | Derivado de entidades; revisar alcance, columnas y permisos. Contenido [CONFIRMADO por frontend]; cache [INFERIDO razonable]; semántica [REQUIERE VALIDACION DE NEGOCIO] |
| `r_pagos` — Pagos | Todos los pagos, sin excluir estado/contrato anulado | ID; Contrato; Factura / Cuenta; Concepto; Fecha radicado; Fecha pago; Valor bruto; IVA; Retenciones; Neto a pagar; Estado | payments, contracts | GET /api/reports/r_pagos; lectura VER; exportar EXPORTAR | Derivado de entidades; revisar alcance, columnas y permisos. Contenido [CONFIRMADO por frontend]; cache [INFERIDO razonable]; semántica [REQUIERE VALIDACION DE NEGOCIO] |
| `r_gar` — Garantías | Todas las garantías, incluidos estados anulada/rechazada | ID; Contrato; Póliza; Aseguradora; Amparo; Valor asegurado; Prima; Inicio vigencia; Vencimiento; Modalidad; Estado | guarantees, contracts | GET /api/reports/r_gar; lectura VER; exportar EXPORTAR | Derivado de entidades; revisar alcance, columnas y permisos. Contenido [CONFIRMADO por frontend]; cache [INFERIDO razonable]; semántica [REQUIERE VALIDACION DE NEGOCIO] |
| `r_inc` — Incumplimientos | Todos los incumplimientos | ID; Contrato; Fecha; Tipo; Descripción; Impacto; Multa; Plan de acción; Responsable; Estado | breaches, contracts | GET /api/reports/r_inc; lectura VER; exportar EXPORTAR | Derivado de entidades; revisar alcance, columnas y permisos. Contenido [CONFIRMADO por frontend]; cache [INFERIDO razonable]; semántica [REQUIERE VALIDACION DE NEGOCIO] |
| `r_rg` — Riesgos | Todos los riesgos; normaliza alias con riskPresentation | ID; Contrato; Categoría; Descripción; P; I; Nivel; Mitigación; Responsable; Estado | risks, contracts | GET /api/reports/r_rg; lectura VER; exportar EXPORTAR | Derivado de entidades; revisar alcance, columnas y permisos. Contenido [CONFIRMADO por frontend]; cache [INFERIDO razonable]; semántica [REQUIERE VALIDACION DE NEGOCIO] |
| `r_sub` — Subcontratos | Todos los subcontratos | ID; Contrato principal; N.º Subcontrato; Subcontratista; NIT; Objeto; Valor; Inicio; Fin; % Ejecución; Estado; Responsable | subcontracts, contracts | GET /api/reports/r_sub; lectura VER; exportar EXPORTAR | Derivado de entidades; revisar alcance, columnas y permisos. Contenido [CONFIRMADO por frontend]; cache [INFERIDO razonable]; semántica [REQUIERE VALIDACION DE NEGOCIO] |
| `r_aud` — Auditoría | Auditoría en orden inverso al array almacenado | Fecha; Usuario; Rol; Acción; Módulo; Contrato; Campo; Anterior; Nuevo; Observación | audit_log, contracts, users | GET /api/reports/r_aud; lectura VER + AUDITAR; exportar EXPORTAR | Derivado de entidades; revisar alcance, columnas y permisos. Contenido [CONFIRMADO por frontend]; cache [INFERIDO razonable]; semántica [REQUIERE VALIDACION DE NEGOCIO] |
| `r_resp` — Contratos por responsable | Agrupa portfolio por responsable textual | Responsable; Contratos; Activos; En riesgo / críticos; Valor actualizado; Ejecutado; Saldo; % ejecución | contracts, execs | GET /api/reports/r_resp; lectura VER; exportar EXPORTAR | Derivado de entidades; revisar alcance, columnas y permisos. Contenido [CONFIRMADO por frontend]; cache [INFERIDO razonable]; semántica [REQUIERE VALIDACION DE NEGOCIO] |
| `r_aseg` — Reporte por aseguradora | Portfolio no anulado; pólizas no anuladas/rechazadas; cupos no Anulado; vencimientos solo aprobadas a 0..30 y vencidas | Aseguradora; Pólizas; Contratos; Valor asegurado; Primas; Por cupo; Individuales; Cupo total; Cupo utilizado; Vencen ≤ 30 d; Vencidas | guarantees, cupos, contracts | GET /api/reports/r_aseg; lectura VER; exportar EXPORTAR | Derivado de entidades; revisar alcance, columnas y permisos. Contenido [CONFIRMADO por frontend]; cache [INFERIDO razonable]; semántica [REQUIERE VALIDACION DE NEGOCIO] |
| `r_aseg_det` — Pólizas por aseguradora y contrato | Todas las pólizas ordenadas por aseguradora y contrato; incluye anuladas/rechazadas | Aseguradora; Contrato; Póliza; Amparo; Valor asegurado; Prima; Vencimiento; Modalidad; Estado | guarantees, contracts | GET /api/reports/r_aseg_det; lectura VER; exportar EXPORTAR | Derivado de entidades; revisar alcance, columnas y permisos. Contenido [CONFIRMADO por frontend]; cache [INFERIDO razonable]; semántica [REQUIERE VALIDACION DE NEGOCIO] |
| `r_cupos` — Cupos por aseguradora | Todos los cupos incluso Anulado; utilizado/disponible/%Uso y vigencia | ID; Número de cupo; Aseguradora; Valor cupo; Utilizado; Disponible; % Uso; Fecha inicio; Fecha vencimiento; Estado | cupos, guarantees | GET /api/reports/r_cupos; lectura VER; exportar EXPORTAR | Derivado de entidades; revisar alcance, columnas y permisos. Contenido [CONFIRMADO por frontend]; cache [INFERIDO razonable]; semántica [REQUIERE VALIDACION DE NEGOCIO] |
| `r_region` — Contratos por departamento y región | Por departamento con contratos; agregación del mapa sin filtros; orden número contratos desc; repetición por presencia territorial | Departamento; Región; Contratos; Valor contratado; Pólizas; Valor asegurado; Clientes | contracts, guarantees, catalogs/catalog_items | GET /api/reports/r_region; lectura VER; exportar EXPORTAR | Derivado de entidades; revisar alcance, columnas y permisos. Contenido [CONFIRMADO por frontend]; cache [INFERIDO razonable]; semántica [REQUIERE VALIDACION DE NEGOCIO] |
| `r_sup` — Contratos por supervisor | Agrupa portfolio por supervisor textual | Supervisor; Contratos; Activos; En riesgo / críticos; Valor actualizado; Ejecutado; Saldo; % ejecución | contracts, execs | GET /api/reports/r_sup; lectura VER; exportar EXPORTAR | Derivado de entidades; revisar alcance, columnas y permisos. Contenido [CONFIRMADO por frontend]; cache [INFERIDO razonable]; semántica [REQUIERE VALIDACION DE NEGOCIO] |

Los agrupados cuentan contratos Activo efectivos, riesgo/crítico con nivel ≥3, suman valor/ejecutado/saldo y calculan financiero ponderado por valor (redondeo de visualización a un decimal). Responsable y supervisor son cadenas, no necesariamente FK a usuarios. No asumir que el número de clientes o contratos reportados es sumable entre departamentos.

### 4.6 Validación y conciliación del expediente

**Validación guardada**: 13 áreas exactas: Fechas, Valores, Porcentajes, Garantías, Obligaciones, Pagos, Documentos, Ejecución, Modificaciones, Subcontratos, Riesgos, Incumplimientos, Liquidación. Severidades Alta/Media/Baja, campos actual/esperado, mensaje y recomendación; orden de mayor severidad. Comprueba fechas y estado vencido, última prórroga, suma de adiciones, ejecución/pagos excedidos, saldo, reducciones, advertencia de adiciones >50% del inicial, avance físico, brecha, avance <70% cuando plazo >90%, garantías y cobertura, obligaciones, neto, soporte, documentos, total/plazo subcontratado, riesgos, incumplimientos y acta de liquidación. **El aviso del 50% no acredita un tope legal aplicable ni bloquea el formulario.** [CONFIRMADO por frontend]; aplicabilidad [REQUIERE VALIDACION DE NEGOCIO].

**Conciliación**: primer documento no Anulado con categoría Contrato y extracted; ocho filas exactas: Valor, Fecha de inicio, Fecha de terminación, Plazo, Objeto, Contratista, NIT, Garantías. Valor compara con inicial con tolerancia <1; objeto trim exacto; contratista trim e insensible a mayúsculas; NIT compara solo dígitos; garantías compara texto/lista. Sin documento/extracción devuelve null. [CONFIRMADO por frontend].

Endpoints existentes `POST /api/contracts/:id/validate` y `GET /api/contracts/:id/reconcile`, permiso VER. Usan motores reales; revisar equivalencia completa, categorías requeridas y alias. OCR no está implementado como reconocimiento real; extracted puede registrarse manualmente.

## 5. Formularios: campos, validaciones y mutaciones que el backend debe revalidar

### 5.1 Inventario exacto de controles de los 32 formularios

Inventario extraído de JSX de los 16 formularios globales y los 16 del expediente. Un control `required/min/max` es una restricción del cliente, no una restricción persistente. Los campos de solo lectura/contexto se listan en la matriz de vistas; la tabla siguiente enumera controles editables. Campos dinámicos y alias conservan su nombre observado. CID y recordId pueden llegar por ruta y nunca deben confiarse sin autorización. [CONFIRMADO por frontend].

| Archivo / formulario | Controles y atributos declarados | Estado |
|---|---|---|
| `components/forms/ActaForm.tsx` | `contractId` (Select); `tipo` (Select); `numero` (Input); `fecha` (Input, tipo date); `firmantes` (Input); `descripcion` (Textarea); `estado` (Select); `archivo` (Input) | [CONFIRMADO por frontend] |
| `components/forms/ContratoForm.tsx` | `numero` (Input); `tipo` (Select); `companyId` (Select); `contratista` (Input); `nitContratista` (Input); `estado` (Select); `objeto` (Textarea); `responsable` (Input); `supervisor` (Input); `fechaFirma` (Input, tipo date); `fechaInicio` (Input, tipo date); `fechaFin` (Input, tipo date); `(control sin name)` (input, tipo checkbox); `avanceFisico` (Input, tipo number, min=0, max=100); `valorBase` (Input, tipo number, min=0); `cur` (Select); `iva` (Input, tipo number, min=0); `adiciones` (Input, tipo number, min=0); `reducciones` (Input, tipo number, min=0); `descripcion` (Textarea); `productos` (Textarea); `indicadores` (Input) | [CONFIRMADO por frontend] |
| `components/forms/CupoForm.tsx` | `aseguradora` (Select); `numero` (Input); `valor` (Input, tipo number, min={0}); `estado` (Select); `fechaInicio` (Input, tipo date); `fechaVenc` (Input, tipo date); `tomador` (Input); `intermediario` (Input); `observaciones` (Textarea) | [CONFIRMADO por frontend] |
| `components/forms/DocumentoForm.tsx` | `contractId` (Select); `nombre` (Input); `categoria` (Select); `archivo` (Input); `motivo` (Input); `obs` (Textarea) | [CONFIRMADO por frontend] |
| `components/forms/EjecucionForm.tsx` | `contractId` (Select); `periodo` (Select); `periodo` (Select); `valor` (Input, tipo number); `avanceFisico` (Input, tipo number, min={0}, max={100}); `obs` (Textarea) | [CONFIRMADO por frontend] |
| `components/forms/EmpresaForm.tsx` | `nit` (Input); `estado` (Select); `razon` (Input); `rep` (Input); `tipo` (Select); `tel` (Input); `email` (Input, tipo email); `direccion` (Input) | [CONFIRMADO por frontend] |
| `components/forms/GarantiaForm.tsx` | `contractId` (Select); `aseguradora` (Select); `tipo` (Select); `estado` (Select); `poliza` (Input); `modalidadPoliza` (Select); `porcentaje` (Input, tipo number, min={0}, max={100}); `tomador` (Input); `intermediario` (Input); `cupoId` (Select); `valor` (Input, tipo number, min={0}); `prima` (Input, tipo number, min={0}); `fechaExp` (Input, tipo date); `fechaInicio` (Input, tipo date); `fechaVenc` (Input, tipo date) | [CONFIRMADO por frontend] |
| `components/forms/IncumplimientoForm.tsx` | `contractId` (Select); `fecha` (Input, tipo date); `tipo` (Select); `impacto` (Select); `descripcion` (Textarea); `multa` (Input, tipo number, min={0}); `responsable` (Input); `estado` (Select); `planAccion` (Textarea) | [CONFIRMADO por frontend] |
| `components/forms/ModificacionForm.tsx` | `contractId` (Select); `tipo` (Select); `numero` (Input); `fecha` (Input, tipo date); `selectedMetrics ? money(selectedMetrics.valorActual) : '—'` (Input); `valorNuevo` (Input, tipo number); `selectedContract?.fechaFin ? fdate(selectedContract.fechaFin) : '—'` (Input); `fechaNueva` (Input, tipo date); `nuevoTexto` (Input); `nuevoTexto` (Input); `justificacion` (Textarea); `soporte` (Input) | [CONFIRMADO por frontend] |
| `components/forms/PagoForm.tsx` | `contractId` (Select); `numero` (Input); `factura` (Input); `fecha` (Input, tipo date); `periodo` (Select); `periodo` (Select); `bruto` (Input, tipo number); `iva` (Input, tipo number); `retenciones` (Input, tipo number); `money(neto)` (Input); `soporte` (Input) | [CONFIRMADO por frontend] |
| `components/forms/PlanForm.tsx` | `contractId` (Select); `accion` (Textarea); `responsable` (Input); `fechaInicio` (Input, tipo date); `fechaFin` (Input, tipo date); `avance` (Input, tipo number, min={0}, max={100}); `estado` (Select) | [CONFIRMADO por frontend] |
| `components/forms/RiesgoForm.tsx` | `contractId` (Select); `categoria` (Select); `estado` (Select); `probabilidad` (Input, tipo number, min={1}, max={5}); `impacto` (Input, tipo number, min={1}, max={5}); `descripcion` (Textarea); `mitigacion` (Textarea); `responsable` (Input) | [CONFIRMADO por frontend] |
| `components/forms/SubcontratoForm.tsx` | `contractId` (Select); `numero` (Input); `estado` (Select); `responsable` (Input); `contratista` (Input); `nit` (Input); `valor` (Input, tipo number, min={0}); `fechaInicio` (Input, tipo date); `fechaFin` (Input, tipo date); `ejecucion` (Input, tipo number, min={0}, max={100}); `objeto` (Textarea) | [CONFIRMADO por frontend] |
| `components/forms/TareaForm.tsx` | `titulo` (Input); `asignado` (Select); `vence` (Input, tipo date) | [CONFIRMADO por frontend] |
| `components/forms/UsuarioForm.tsx` | `nombre` (Input); `email` (Input, tipo email); `rol` (Select); `estado` (Select) | [CONFIRMADO por frontend] |
| `components/forms/VersionDocumentoForm.tsx` | `archivo` (Input); `motivo` (Input); `cambios` (Textarea) | [CONFIRMADO por frontend] |
| `components/expediente/forms/ActaForm.tsx` | `tipo` (Select); `numero` (Input); `fecha` (Input, tipo date); `estado` (Select); `firmantes` (Input); `descripcion` (Textarea); `archivo` (Input) | [CONFIRMADO por frontend] |
| `components/expediente/forms/DocumentoForm.tsx` | `nombre` (Input); `categoria` (Select); `archivo` (Input, tipo text) | [CONFIRMADO por frontend] |
| `components/expediente/forms/EjecucionForm.tsx` | `periodo` (Input, tipo month, required true); `valor` (Input, tipo number, min=0, required true); `avanceFisico` (Input, tipo number, min=0, max=100, required true); `obs` (Input) | [CONFIRMADO por frontend] |
| `components/expediente/forms/EntregableForm.tsx` | `nombre` (Input, required true); `descripcion` (Textarea); `fechaInicio` (Input, tipo date, required true); `fechaProg` (Input, tipo date, required true); `responsable` (Input) | [CONFIRMADO por frontend] |
| `components/expediente/forms/EntregaForm.tsx` | `estado` (Select); `avance` (Input, tipo number, min=0, max=100, required true); `fechaReal` (Input, tipo date); `evidencia` (Input); `obs` (Textarea) | [CONFIRMADO por frontend] |
| `components/expediente/forms/GarantiaForm.tsx` | `poliza` (Input); `tipo` (Select); `aseguradora` (Select); `modalidadPoliza` (Select); `cupoId` (Select); `valor` (Input, tipo number, min=0); `porcentaje` (Input, tipo number, min=0, max=100); `fechaInicio` (Input, tipo date); `fechaVenc` (Input, tipo date) | [CONFIRMADO por frontend] |
| `components/expediente/forms/IncumplimientoForm.tsx` | `tipo` (Select); `fecha` (Input, tipo date, required true); `obligationId` (Select); `impacto` (Select); `estado` (Select); `responsable` (Input); `descripcion` (Textarea, required true); `medida` (Input); `multa` (Input, tipo number, min=0); `plan` (Input) | [CONFIRMADO por frontend] |
| `components/expediente/forms/ModificacionForm.tsx` | `tipo` (Select); `numero` (Input, required true); `fecha` (Input, tipo date, required true); `valorNuevo` (Input, tipo number, min=0, required true); `fdateSeguro(c.fechaFin)` (Input); `fechaNueva` (Input, tipo date); `nuevoTexto` (Input, required true); `nuevoTexto` (Input, required true); `justificacion` (Textarea, required true); `soporte` (Input) | [CONFIRMADO por frontend] |
| `components/expediente/forms/ObligacionForm.tsx` | `descripcion` (Textarea); `tipo` (Select); `periodicidad` (Select); `responsable` (Input); `fechaLimite` (Input, tipo date); `evidencia` (Input); `obs` (Input) | [CONFIRMADO por frontend] |
| `components/expediente/forms/PagoForm.tsx` | `numero` (Input); `factura` (Input); `fecha` (Input, tipo date); `periodo` (Input, tipo month); `bruto` (Input, tipo number, min=0); `iva` (Input, tipo number, min=0); `retenciones` (Input, tipo number, min=0); `soporte` (Input) | [CONFIRMADO por frontend] |
| `components/expediente/forms/PlanForm.tsx` | `hallazgo` (Textarea, required true); `causa` (Textarea); `accion` (Textarea, required true); `fecha` (Input, tipo date, required true); `responsable` (Input); `estado` (Select); `avance` (Input, tipo number, min=0, max=100, required true); `accion` (Textarea, required true); `responsable` (Input) | [CONFIRMADO por frontend] |
| `components/expediente/forms/ProrrogaForm.tsx` | `fdate(c.fechaFin)` (Input); `diasAdd` (Input, tipo number, min=1); `nuevaFecha` (Input, tipo date); `numero` (Input); `justificacion` (Textarea); `soporte` (Input) | [CONFIRMADO por frontend] |
| `components/expediente/forms/ReinicioForm.tsx` | `fecha` (Input, tipo date); `diasProrroga` (Input, tipo number, min=0); `nuevaFechaFin` (Input); `soporte` (Input); `justificacion` (Textarea) | [CONFIRMADO por frontend] |
| `components/expediente/forms/RiesgoForm.tsx` | `riesgo` (Textarea, required true); `categoria` (Select); `responsable` (Input); `prob` (Select); `impacto` (Select); `tratamiento` (Select); `estado` (Select); `mitigacion` (Textarea); `evidencia` (Input) | [CONFIRMADO por frontend] |
| `components/expediente/forms/SubcontratoForm.tsx` | `numero` (Input, required true); `contratista` (Input, required true); `nit` (Input, required true); `valor` (Input, tipo number, min=0, required true); `fechaInicio` (Input, tipo date, required true); `fechaFin` (Input, tipo date, required true); `ejecucion` (Input, tipo number, min=0, max=100); `estado` (Select); `objeto` (Textarea, required true); `documentos` (Input) | [CONFIRMADO por frontend] |
| `components/expediente/forms/SuspensionForm.tsx` | `fecha` (Input, tipo date); `soporte` (Input); `justificacion` (Textarea) | [CONFIRMADO por frontend] |

### 5.2 Validaciones y efectos de formularios globales

| Formulario | Validaciones de cliente / acción | Revalidación, diferencias y decisiones pendientes | Estado |
|---|---|---|---|
| Acta | Contrato, número trim y fecha obligatorios; descripción/firmantes/archivo opcionales; nombre de archivo simulado si falta. | Estados Borrador/En firmas no equivalen al DTO Borrador acta; firmantes no tiene campo API. | Cliente [CONFIRMADO por frontend]; normalización [INFERIDO razonable]; política adicional [REQUIERE VALIDACION DE NEGOCIO] |
| Contrato | Validator.draft: bloquea solo Alta: falta/duplicado de número, fin anterior a inicio, reducciones > inicial+adiciones, físico >100. Media: objeto vacío, inicio anterior a firma, duración discordante >1 día, IVA >19%+1. No exige todas las fechas en borrador. | Cuatro secciones General/Fechas/Económica/Alcance. Defaults al guardar: empresa primera, contratista Por definir, responsable Administración, supervisor Por asignar, fechas inicio/fin hoy, objeto Sin objeto especificado. El API exige campos que el draft permite omitir, incluido NIT. No adoptar defaults como información verificada. | Cliente [CONFIRMADO por frontend]; normalización [INFERIDO razonable]; política adicional [REQUIERE VALIDACION DE NEGOCIO] |
| Cupo | Número trim, valor truthy, inicio/vencimiento obligatorios, vencimiento ≥inicio. | Valor truthy permite negativos en handler; backend debe validar positivo. Estados y disponibilidad deben acordarse; no inventar cupo bancario ni otro producto. | Cliente [CONFIRMADO por frontend]; normalización [INFERIDO razonable]; política adicional [REQUIERE VALIDACION DE NEGOCIO] |
| Documento | Contrato y nombre trim obligatorios; archivo de texto opcional; crea documento Activo con versión 1. | No carga bytes; API multipart exige archivo real. Contrastar categoría/obs/motivo y versión inicial. | Cliente [CONFIRMADO por frontend]; normalización [INFERIDO razonable]; política adicional [REQUIERE VALIDACION DE NEGOCIO] |
| Ejecucion | Contrato, periodo y valor truthy obligatorios. | Handler global no replica valor>0, rango de avance ni periodo único del expediente. Validar YYYY-MM y unicidad/posibilidad de varios informes por periodo con negocio. | Cliente [CONFIRMADO por frontend]; normalización [INFERIDO razonable]; política adicional [REQUIERE VALIDACION DE NEGOCIO] |
| Empresa | Razón y NIT trim obligatorios; NIT único salvo propio ID; email opcional válido. | Aliases name/razon; estado visible no está en DTO de actualización. No se valida dígito de verificación ni forma legal del NIT. | Cliente [CONFIRMADO por frontend]; normalización [INFERIDO razonable]; política adicional [REQUIERE VALIDACION DE NEGOCIO] |
| Garantia | Contrato, póliza trim, valor truthy e inicio/vencimiento; vencimiento no anterior a inicio. Si cupo seleccionado y excede disponible, pide confirmación. | No exige siempre cupoId en global; admite estado Aprobada con guard crear. API debe exigir APROBAR y verificar aseguradora/cupo, saldo y fechas. Exceso es confirmable en cliente, no evidencia de autorización legal. | Cliente [CONFIRMADO por frontend]; normalización [INFERIDO razonable]; política adicional [REQUIERE VALIDACION DE NEGOCIO] |
| Incumplimiento | Contrato existente, fecha, descripción trim; multa ≥0; crear/editar según contexto. | planAccion del global frente a plan del API; vinculación con obligación, evidencia y estados requieren equivalencia. | Cliente [CONFIRMADO por frontend]; normalización [INFERIDO razonable]; política adicional [REQUIERE VALIDACION DE NEGOCIO] |
| Modificacion | Contrato, número trim, fecha, justificación trim; valorNuevo truthy para adición/reducción; fechaNueva para tipos que tocan fecha; nuevoTexto en cesión/supervisor. Guard editar. | No verifica todas las reglas direccionales del expediente. Modificación de cláusula no pertenece a TIPOS_MOD del API. Otrosí es etiqueta de radicado, no tipo independiente. No agregar un tipo sin acuerdo. | Cliente [CONFIRMADO por frontend]; normalización [INFERIDO razonable]; política adicional [REQUIERE VALIDACION DE NEGOCIO] |
| Pago | Contrato, número trim, bruto truthy y fecha; neto=bruto+iva−retenciones; crea Pendiente. | Factura no obligatoria en cliente, requerida por API. Neto negativo no está bloqueado explícitamente; confirmar tratamiento de impuestos/retenciones y redondeo. Nunca aceptar neto calculado por cliente como fuente. | Cliente [CONFIRMADO por frontend]; normalización [INFERIDO razonable]; política adicional [REQUIERE VALIDACION DE NEGOCIO] |
| Plan | Contrato existente, acción trim, avance 0..100; si ambas fechas existen, fin≥inicio. | Global usa fechaInicio/fechaFin, no exige hallazgo; API exige hallazgo y fecha. Fechas y estados En curso/Cumplido/Incumplido no son equivalentes al DTO actual. | Cliente [CONFIRMADO por frontend]; normalización [INFERIDO razonable]; política adicional [REQUIERE VALIDACION DE NEGOCIO] |
| Riesgo | Contrato existente, descripción trim, probabilidad e impacto 1..5; nivel derivado P×I. | Global escribe descripcion/probabilidad; API exige riesgo/prob. Resolver alias antes de enviar; tratamiento/mitigación no son sinónimos automáticos. | Cliente [CONFIRMADO por frontend]; normalización [INFERIDO razonable]; política adicional [REQUIERE VALIDACION DE NEGOCIO] |
| Subcontrato | Padre existente no anulado; número/contratista/NIT/objeto trim; valor>0; inicio/fin; fin≥inicio; ejecución 0..100; suma hermanos+valor≤actual del padre; fin≤fin principal. | Suma global de hermanos excluye edición propia, pero puede incluir anulados. Backend excluye anulados de cap y no comprueba plazo principal. Debe acordarse qué estados consumen valor. | Cliente [CONFIRMADO por frontend]; normalización [INFERIDO razonable]; política adicional [REQUIERE VALIDACION DE NEGOCIO] |
| Tarea | Título trim y vence obligatorios; asignado puede usar responsable de alerta/usuario por defecto. | Crea Abierta; si origen Nueva marca Leída. API asigna ID de usuario y no reproduce necesariamente cambio de alerta en misma operación. | Cliente [CONFIRMADO por frontend]; normalización [INFERIDO razonable]; política adicional [REQUIERE VALIDACION DE NEGOCIO] |
| Usuario | ADMINISTRADOR y permiso crear/editar; nombre/email trim; formato email. | Frontend no impone nombre≥3 del API; rol/estado visibles; API update no permite estado. Email único requiere enforcement server/DB. | Cliente [CONFIRMADO por frontend]; normalización [INFERIDO razonable]; política adicional [REQUIERE VALIDACION DE NEGOCIO] |
| VersionDocumento | Archivo trim obligatorio; motivo por defecto Actualización de versión; nuevo ordinal=longitud+1; conserva anteriores. Guard editar. | Frontend último=final del array; API ordena descendente. API requiere archivo multipart y motivo mínimo. Ordinal debe generarse atómicamente en servidor. | Cliente [CONFIRMADO por frontend]; normalización [INFERIDO razonable]; política adicional [REQUIERE VALIDACION DE NEGOCIO] |

### 5.3 Validaciones y efectos de formularios del expediente

| Formulario | Validaciones de cliente / acción | Revalidación, diferencias y decisiones pendientes | Estado |
|---|---|---|---|
| Acta | Número trim y fecha; CID heredado; crear. | Mismos estados incompatibles y firmantes/archivo mock que global. | Cliente [CONFIRMADO por frontend]; contrato servidor [INFERIDO razonable]; regla no acordada [REQUIERE VALIDACION DE NEGOCIO] |
| Documento | Nombre trim; CID heredado; categoría preseleccionable; crear. | Archivo texto opcional; versión 1 con fecha/usuario; no transferencia. | Cliente [CONFIRMADO por frontend]; contrato servidor [INFERIDO razonable]; regla no acordada [REQUIERE VALIDACION DE NEGOCIO] |
| Ejecucion | Periodo obligatorio, valor>0, avanceFisico 0..100; no duplicar periodo de mismo padre excluyendo edición propia; crear/editar. | Payload guarda avance en Exec, no actualiza Contract.avanceFisico. El API solo limita longitud de periodo y no garantiza unicidad. | Cliente [CONFIRMADO por frontend]; contrato servidor [INFERIDO razonable]; regla no acordada [REQUIERE VALIDACION DE NEGOCIO] |
| Entregable | Nombre trim y fechaProg; fechaProg≥fechaInicio cuando ambas existen; inputs de fechas required. | Crear inicia Pendiente/0; responsable fallback supervisor/usuario. Editar planificación conserva seguimiento. | Cliente [CONFIRMADO por frontend]; contrato servidor [INFERIDO razonable]; regla no acordada [REQUIERE VALIDACION DE NEGOCIO] |
| Entrega | Avance 0..100; editar; comprobar pertenencia al contrato. | Al seleccionar Aprobado/Entregado fija avance=100; guardar no reimpone esa regla si el usuario cambia avance después. FechaReal input date opcional. Decidir aprobación y evidencia obligatoria con negocio. | Cliente [CONFIRMADO por frontend]; contrato servidor [INFERIDO razonable]; regla no acordada [REQUIERE VALIDACION DE NEGOCIO] |
| Garantia | Póliza trim, valor>0, inicio/vencimiento requeridos y ordenados; modalidad por cupo requiere cupoId; crear. | Estado inicial Pendiente; revisar cupo/aseguradora/amparo y eventual necesidad de cobertura/plazo como bloqueo o advertencia. | Cliente [CONFIRMADO por frontend]; contrato servidor [INFERIDO razonable]; regla no acordada [REQUIERE VALIDACION DE NEGOCIO] |
| Incumplimiento | Fecha y descripción trim; multa≥0; crear/editar; pertenencia al expediente. | Alta vs gestión permite diferentes campos; edición de medida, plan y estado. Estados completos deben aceptarse o mapearse. | Cliente [CONFIRMADO por frontend]; contrato servidor [INFERIDO razonable]; regla no acordada [REQUIERE VALIDACION DE NEGOCIO] |
| Modificacion | Número y justificación trim; valorNuevo>0 para cambios de valor; reducción<actual; fechaNueva para cambios de fecha; prórroga>fin actual; nuevoTexto para cambios textuales. Editar. | Fecha inicializada a hoy, pero handler no impone todas las validaciones globales. Adición puede no verificar estrictamente incremento. Persistir efecto y registro en transacción. | Cliente [CONFIRMADO por frontend]; contrato servidor [INFERIDO razonable]; regla no acordada [REQUIERE VALIDACION DE NEGOCIO] |
| Obligacion | Descripción/responsable trim y fechaLimite obligatorios; crear. | Tipo, periodicidad, evidencia/obs; crea Pendiente con cumplimiento=0. Actualización/checklist/verificación tienen flujos propios en ficha. | Cliente [CONFIRMADO por frontend]; contrato servidor [INFERIDO razonable]; regla no acordada [REQUIERE VALIDACION DE NEGOCIO] |
| Pago | Número trim y bruto>0; crear. | Fecha inicial hoy; IVA sugerido round(bruto×0,19) al cambiar bruto; usuario puede ajustar; neto calculado; factura y soporte no exigidos. No convertir sugerencia 19% en tarifa universal. | Cliente [CONFIRMADO por frontend]; contrato servidor [INFERIDO razonable]; regla no acordada [REQUIERE VALIDACION DE NEGOCIO] |
| Plan | Hallazgo trim requerido al crear, acción trim, fecha límite, avance 0..100; crear/editar. | Fecha representa compromiso; estado/causa/responsable/evidencia; conservar campos de creación en edición. | Cliente [CONFIRMADO por frontend]; contrato servidor [INFERIDO razonable]; regla no acordada [REQUIERE VALIDACION DE NEGOCIO] |
| Prorroga | Nueva fecha obligatoria >fin vigente; días de ampliación≥1; justificación trim; editar. | Número puede generarse; crea modificación, cambia fecha del contrato, reactiva si Terminado y advierte garantías. No auto-renueva pólizas. | Cliente [CONFIRMADO por frontend]; contrato servidor [INFERIDO razonable]; regla no acordada [REQUIERE VALIDACION DE NEGOCIO] |
| Reinicio | Fecha y justificación trim; díasProrroga≥0; editar. | Crea modificación y acta, activa contrato y opcionalmente amplía fin; calcular ampliación de suspensión y validar estado de origen debe acordarse. | Cliente [CONFIRMADO por frontend]; contrato servidor [INFERIDO razonable]; regla no acordada [REQUIERE VALIDACION DE NEGOCIO] |
| Riesgo | Evento riesgo trim; prob e impacto 1..5; crear/editar; pertenencia. | Usa nombres riesgo/prob compatibles con DTO; tratamiento, mitigación, evidencia y estado por separado. | Cliente [CONFIRMADO por frontend]; contrato servidor [INFERIDO razonable]; regla no acordada [REQUIERE VALIDACION DE NEGOCIO] |
| Subcontrato | Número/contratista/NIT/objeto trim; valor>0; fin≥inicio si ambas fechas; ejecución 0..100; pertenencia; crear/editar. | No replica cap total ni fin≤principal del global; handlers no exigen explícitamente ambas fechas. Backend debe unificar criterios aprobados. | Cliente [CONFIRMADO por frontend]; contrato servidor [INFERIDO razonable]; regla no acordada [REQUIERE VALIDACION DE NEGOCIO] |
| Suspension | Fecha y justificación trim; editar. | Crea modificación y acta y suspende contrato. Fuera de plazo se advierte; no demuestra bloqueo. Revisar estado origen, retroactividad y efectos sobre obligaciones/entregables/pólizas. | Cliente [CONFIRMADO por frontend]; contrato servidor [INFERIDO razonable]; regla no acordada [REQUIERE VALIDACION DE NEGOCIO] |

### 5.4 Edición y acciones fuera de formularios dedicados

[CONFIRMADO por frontend]. También hay controles en Configuración (umbrales, permisos, catálogos, perfil y almacenamiento demo), ObligacionFicha (estado/cumplimiento, checklist, comentarios, evidencia, verificación), pestañas de aprobación/anulación de pagos y garantías, gestión de alertas (Leída/Delegada/Resuelta y nota), gestión de tareas (estado), búsqueda/filtros y vistas de conciliación documental. No excluir estos comandos por no ser un archivo Form.

- **Checklist**: añadir/toggle de ítems; en frontend alimenta cumplimiento y estado. Recalcular en servidor con tabla obligation_checklist y transacción; no permitir enviar porcentaje incompatible.
- **Comentarios/evidencias**: autor y fecha derivan de sesión/hora del servidor. La evidencia mock es textual; acordar archivo real, tipo, tamaño y vínculo al documento.
- **Verificar obligación**: pide permiso de aprobación y conserva quién/cuándo verificó en front. Debe acordarse si requiere 100%, evidencia o todos los ítems; el API actual no conserva esos metadatos ni actualiza porcentaje por verificar.
- **Pagos/garantías**: permisos de aprobación se validan en backend incluso al crear o actualizar directamente un estado equivalente; no solo en botones especializados.
- **Anulación**: motivo obligatorio en flujos que lo piden; conservar historial. En modificaciones el frontend revierte parcialmente algunos efectos, mientras el backend no ofrece reversión equivalente. El comportamiento deseado requiere aprobación funcional.
- **Configuración**: distinguir parámetros operativos, catálogos y permisos de una sesión demo/localStorage. Exportar/importar copia local no implica que exista un servicio autorizado de restauración de base de datos.

### 5.5 Contrato de validación recomendado

[INFERIDO razonable]. Revalidar tipo, longitud, enumeración, rango, fechas, existencia de FK, pertenencia al padre, autorización, unicidad y versión en cada comando; generar IDs/autor/fecha/versiones/neto en servidor. Separar advertencias (no bloqueantes observadas) de errores de negocio aprobados. Devolver errores por campo y conflictos HTTP 409 de forma estable; mantener conservación de registros históricos y auditabilidad.

No trasladar todos los avisos del prototipo a prohibiciones. El DTO debe documentar nombres canónicos y adaptar alias legados; con `ValidationPipe(whitelist:true)` los campos no declarados pueden desaparecer sin rechazo, dando una falsa impresión de guardado completo. Validar, en particular, riesgo/descripcion, prob/probabilidad, plan/planAccion, fecha/fechaFin, estados de actas/planes y firmantes.

Versiones optimistic-lock, cifras decimales y zona horaria deben aplicarse uniformemente. Para creación/edición compuesta de modificación + contrato + acta + auditoría se recomienda una transacción y una clave de idempotencia; su necesidad técnica es [INFERIDO razonable], no una regla legal.

## 6. Autenticación, roles, menú y acciones visibles

### 6.1 Flujo de sesión observado y diferencia con identidad real

[CONFIRMADO por frontend]. Login exige email válido y contraseña no vacía de al menos 6 caracteres. Simula espera y busca usuario Activo por email; **no verifica la contraseña contra un secreto**. Credenciales demo rellenan demo1234. “Recordarme” selecciona almacenamiento persistente/de sesión del flag `ss_auth_v1`. `AuthService.getToken()` retorna `demo-token`, no un JWT real; `settings.currentUser` decide identidad; hay selector de usuario demo en cabecera. La salida elimina flags de sesión locales.

API existente: `POST /api/auth/login` recibe email y emite JWT para usuario activo sembrado; `GET /api/me` devuelve usuario, rol y permisos. El README y AuthService lo califican como login de demostración con SSO/OIDC futuro. No se encontró implementación de OIDC, verificación de contraseña, recuperación, refresh ni revocación/logout de token en los módulos actuales. **No presentar el login actual como autenticación productiva.** [REQUIERE VALIDACION DE NEGOCIO]: elegir proveedor y política de sesión antes de exponer datos reales.

Los IDs/nombres de responsables de mocks no prueban membresía de usuario ni pertenencia empresarial. Permisos del cliente no sustituyen los guards API; tampoco el selector demo debe transformarse en suplantación productiva.

### 6.2 Matriz exacta de permisos predeterminados

Fuente `lib/catalog.ts:defaultPerms`. 1 permite, 0 deniega; settings.perms puede alterar valores en el mock y ADMINISTRADOR tiene bypass en AuthService. API usa nombres de permisos en mayúsculas. [CONFIRMADO por frontend].

| Rol | ver | crear | editar | aprobar | anular | exportar | auditar |
|---|---|---|---|---|---|---|---|
| ADMINISTRADOR | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| CONTRATACIÓN | 1 | 1 | 1 | 0 | 0 | 1 | 0 |
| JURÍDICA | 1 | 1 | 1 | 1 | 1 | 1 | 0 |
| FINANCIERA | 1 | 1 | 1 | 1 | 0 | 1 | 0 |
| SUPERVISOR | 1 | 1 | 1 | 1 | 0 | 1 | 0 |
| INTERVENTOR | 1 | 1 | 1 | 0 | 0 | 1 | 0 |
| AUDITOR | 1 | 0 | 0 | 0 | 0 | 1 | 1 |
| CONSULTA | 1 | 0 | 0 | 0 | 0 | 0 | 0 |

Los permisos son transversales; el front no define autorizaciones independientes por empresa, contrato propio o tipo de documento. [REQUIERE VALIDACION DE NEGOCIO]: determinar alcance contractual/empresarial y segregación de funciones, sin presumir multiempresa aislada por tenant.

### 6.3 Menú y protección por vista

**El sidebar renderiza todos los elementos a todos los roles**; no filtra sus links con AuthService.can. Badge de Alertas cuenta Nueva. La denegación se aplica al entrar/actuar mediante PermissionGate/guard, no ocultando toda la navegación. [CONFIRMADO por frontend].

| Grupo | Elementos visibles | Protección relevante / acción |
|---|---|---|
| General | Inicio, Gerencia, Agenda, Calendario | Sesión de aplicación; lectura de indicadores y eventos |
| Contratación | Contratos, Empresas, Subcontratos, Obligaciones, Ejecución, Pagos, Garantías, Aseguradoras / Cupos, Documentos, Actas, Modificaciones | Lectura; alta CREAR; editar EDITAR; algunos flujos contractuales requieren EDITAR para crear actuación |
| Control | Alertas, Riesgos, Incumplimientos, Auditoría, Reportes (19) | Auditoría AUDITAR; reportes VER, r_aud también AUDITAR; exportación EXPORTAR |
| Sistema | Configuración | ADMINISTRADOR; usuarios nuevos/editar también limitados a administrador |

Las rutas dedicadas y la mayoría de handlers protegen mutación con permisos, con las diferencias concretas de sección 5. EmpresaForm guarda sin guard propio; la protección observada está en su ruta, por lo que no sustituye la autorización del API. **Modificación/prórroga/suspensión/reinicio** usan EDITAR porque afectan contrato, aunque insertan un registro. CRUD genérico API normalmente usa CREAR para alta de colección: hace falta especificar si crear una actuación necesita CREAR, EDITAR o ambos. No asumir que uno engloba al otro.

### 6.4 Acciones sensibles por rol

| Acción | Permiso / condición frontend | Diferencia API / decisión |
|---|---|---|
| Ver listados, expediente, mapa, reportes ordinarios | ver; todos los roles iniciales | ReportsController exige EXPORTAR incluso para JSON: CONSULTA queda bloqueado |
| Crear contrato, empresa, hijos y tarea | crear | Revalidar campos y relaciones; no conceder alta por mera visibilidad de link |
| Editar ficha y gestionar entrega | editar | Estado Aprobado de entregable se selecciona bajo editar; decidir si necesita aprobar |
| Registrar actuación contractual | editar | API POST modificación usa crear; acordar política |
| Aprobar/pagar pago y aprobar garantía | aprobar | Exigir en todos los caminos de escritura; alta de pago ya Aprobado/Pagado salta chequeo actual |
| Anular | anular; con motivo donde corresponde | Conservar historia; falla de colección genérica y reversión de efectos pendientes |
| Verificar obligación | aprobar | Persistir autor, fecha y porcentaje/estado de forma coherente |
| Ver auditoría/reporte r_aud | auditar | ADMINISTRADOR/AUDITOR por defaults; mantener filtrado/autorización server |
| Exportar XLSX/PDF/CSV | exportar | CSV no equivalente API; autorización del dataset completa |
| Gestionar catálogos/roles/usuarios | ADMINISTRADOR, además acción pertinente | Lectura de catálogos y usuarios en API también Admin; bloquea opciones de formularios de otros roles |

[REQUIERE VALIDACION DE NEGOCIO]. Acordar acceso de lectura a catálogos/responsables para roles creadores, y diferenciar consulta de reportes de descarga. Un endpoint de opciones puede exponer solamente datos necesarios, sin abrir administración completa.

## 7. GAPs frente al backend actual y defectos de equivalencia

### 7.1 Cobertura existente: no reconstruir lo que ya existe

El README del backend describe un API con JWT demo, empresas/contratos, colecciones hijas, pagos/obligaciones, seguros/cupos, documentos/versiones en disco, alertas/tareas, auditoría encadenada, parámetros/catálogos, usuarios/roles, 19 reportes y agregados geográficos. La lectura de controllers/services y entidades confirma una base extensa, pero no garantiza equivalencia funcional ni ejecución sin defectos. No se ejecutaron migraciones, seeds, servidor ni pruebas de integración. No se modificó código.

| Área | Endpoints equivalentes que sí existen | Límites observados |
|---|---|---|
| Sesión | POST auth/login; GET me | Demo por email; identidad productiva pendiente |
| Empresas | GET/POST companies; GET/PUT companies/:id; POST companies/:id/void | Detalle con indicadores; estado/reactivación no es edición directa; lista sin paginación real |
| Contratos | GET/POST contracts; GET/PUT contracts/:id; POST contracts/:id/void; POST :id/validate; GET :id/reconcile, timeline, audit; POST :id/notify | Filtros/estado efectivo y Cmetrics difieren; notify registra auditoría, no envía correo real |
| Hijos | GET/POST subcontracts, obligations, deliverables, execs, payments, actas, modifications, risks, breaches, plans; GET contracts/:id/{colección}; PUT {colección}/:id donde editable; POST {colección}/:id/void | Búsqueda q inválida por columnas; no GET individual genérico; modificación inmutable |
| Obligaciones | GET obligations/:id; comandos checklist, comentarios, evidencias, verificar | Forma DTO y cumplimiento/verificación difieren |
| Pagos | Comandos de aprobar/pagar además de CRUD | Alta puede evitar autorización de transición |
| Seguros | GET guarantees y contracts/:id/guarantees; POST/PUT/void/approve de garantía; GET insurers y insurers/:nombre/policies; GET/POST/PUT/void quotas | No GET detalle individual garantía/cupo; faltan filtros globales específicos |
| Documentos | GET contracts/:id/documents; POST documents multipart; POST documents/:id/versions multipart; GET archivo de versión; POST extract; PUT extracted; POST void | No listado global/detalle documento ni emisión HTTP de URL firmada; extracción real pendiente |
| Alertas/tareas | Lectura de alertas derivadas, read/resolve/delegate, POST alerts/:key/tasks, GET tasks y PUT tasks/:id | Identidad/cambios compuestos y permisos deben adaptarse |
| Configuración | GET/PUT settings; GET catalogs; GET/PUT catalogs/:nombre; users/roles y permisos | Todos requieren administrador en áreas necesarias para opciones de otros roles |
| Auditoría | GET audit y contracts/:id/audit; cadena de integridad en persistencia | No equivalente al audit editable local; servidor debe generar eventos |
| Reportes | GET reports/:key, 19 claves JSON/XLSX/PDF | CSV/permiso de lectura/columnas distintas |
| Geo | GET geo/departments; GET geo/regions | Atribución territorial, rechazadas, estado y DTO por alinear |
| Dashboard/Gerencia/Agenda/Calendario | Composición posible de colecciones/motores | No hay endpoint agregado explícito de dashboard, gerencia, agenda ni calendario; no significa ausencia de datos básicos |

Los paths de esta tabla se entienden relativos a `/api`. Los comandos especializados se detallan por vista y por hallazgo. Tablas reales: sección 3.4. Al cierre existe CacheModule memoria/Valkey y una migración con tres MV declaradas (7.3); no se verificó su despliegue. Las propuestas de invalidación completan esa base existente.

### 7.2 Hallazgos priorizados con evidencia y acción concreta

La prioridad indica impacto para conectar el frontend a datos reales; P0 es un bypass de autorización o impedimento de identidad productiva, P1 impide operaciones o altera integridad/resultados, P2 es cobertura/mejora pendiente. Los hallazgos se basan en código estático; no se presentan como pruebas HTTP ejecutadas.

#### G01 — P0 — Pago aprobado/pagado sin permiso de aprobación al crear

**Evidencia:** `src/modules/contracts/child-collections.service.ts:239`; `src/modules/contracts/children.dto.ts:14`.

**Brecha:** POST payments exige CREAR; validarReglas comprueba APROBAR únicamente cuando existente no es null. CrearPagoDto acepta estado Aprobado/Pagado y prepararGuardado asigna fechas. Un rol CONTRATACIÓN/INTERVENTOR con CREAR puede solicitar alta directamente aprobada.

**Acción:** Exigir APROBAR en toda entrada a estados sensibles y definir estados iniciales permitidos. Prueba negativa de alta Aprobado/Pagado sin permiso y positiva de alta Pendiente.

**Estado:** necesidad de pantalla [CONFIRMADO por frontend]; diagnóstico de equivalencia y solución técnica [INFERIDO razonable]; política no acordada [REQUIERE VALIDACION DE NEGOCIO].

#### G02 — P0 para producción — Autenticación aún demo en ambos repos

**Evidencia:** `lib/store.ts:41`; `src/modules/auth/auth.service.ts:27`.

**Brecha:** Front valida longitud de password pero no secreto; API login(email) solo busca usuario activo y firma JWT. No existe proveedor productivo ni recuperación/refresh/revocación implementados.

**Acción:** Cerrar alcance demo versus producción con negocio/seguridad e implementar proveedor autorizado antes de usar datos reales. No reutilizar el selector demo como impersonación.

**Estado:** necesidad de pantalla [CONFIRMADO por frontend]; diagnóstico de equivalencia y solución técnica [INFERIDO razonable]; política no acordada [REQUIERE VALIDACION DE NEGOCIO].

#### G03 — P1 — Buscador genérico q usa columnas inexistentes

**Evidencia:** `src/modules/contracts/child-collections.service.ts:91`.

**Brecha:** ChildCollectionsService.listar une numero, contratista, descripcion, riesgo y hallazgo sin distinguir tabla. Ninguna garantía de que cada colección tenga las cinco columnas; entities muestran ausencias. Los buscadores de pagos/riesgos/ejecución y otros pueden producir error SQL.

**Acción:** Definir columnas permitidas por colección y búsqueda ligada a contrato donde el front busca su número; probar q en las diez colecciones.

**Estado:** necesidad de pantalla [CONFIRMADO por frontend]; diagnóstico de equivalencia y solución técnica [INFERIDO razonable]; política no acordada [REQUIERE VALIDACION DE NEGOCIO].

#### G04 — P1 — Anulación genérica rechaza registros no anulados

**Evidencia:** `src/modules/contracts/child-collections.service.ts:183`; `src/modules/contracts/child-registry.ts:13`.

**Brecha:** anular trata cualquier valor no null en campoEstado como ya anulado. Un Subcontrato Activo, Pago Pendiente, Plan Abierto, Modificación Activa o Acta Firmada se rechaza. Execs usa motivoAnulacion y sigue otro camino.

**Acción:** Comparar con estado de anulación específico o motivo, probar estado normal/ya anulado y conservar auditoría. Actas usa Anulada en DTO mientras genérico fija Anulado: unificar sin borrar histórico.

**Estado:** necesidad de pantalla [CONFIRMADO por frontend]; diagnóstico de equivalencia y solución técnica [INFERIDO razonable]; política no acordada [REQUIERE VALIDACION DE NEGOCIO].

#### G05 — P1 — Campos y estados no equivalentes entre los dos juegos de formularios y los DTO

**Evidencia:** `components/forms/RiesgoForm.tsx:22`; `components/forms/PlanForm.tsx:23`; `src/modules/contracts/children.dto.ts:15`.

**Brecha:** Riesgo global envia descripcion/probabilidad, API riesgo/prob; Plan global fechaInicio/fechaFin y sin hallazgo, API fecha/hallazgo; Incumplimiento planAccion frente a plan; Acta firmantes no persistido y Borrador/En firmas no admitidos; Modificación de cláusula no admitida; factura obligatoria API pero no front.

**Acción:** Definir DTO canónico y tabla de aliases aprobada, errores por campo y pruebas de payload de ambos formularios. No remapear estados jurídicos sin validar su significado.

**Estado:** necesidad de pantalla [CONFIRMADO por frontend]; diagnóstico de equivalencia y solución técnica [INFERIDO razonable]; política no acordada [REQUIERE VALIDACION DE NEGOCIO].

#### G06 — P1 — Faltan lecturas para documentos globales/detalle y obtención de URL firmada

**Evidencia:** `src/modules/contracts/documents.controller.ts:16`; `src/modules/contracts/documents.service.ts:93`; `components/forms/VersionDocumentoForm.tsx:35`.

**Brecha:** Frontend ofrece /documentos, /documentos/[docId] y versión nueva directa. API lista por contrato y descarga con token+exp, pero no GET documents global ni GET documents/:id. urlFirmada es método interno no expuesto ni incorporado a listados.

**Acción:** Añadir lectura global filtrada y detalle/versiones autorizados, y exponer URL firmada o incorporarla a respuesta. Conservar JWT/VER y alcance al descargar; no inventar un servicio de almacenamiento nuevo: ya existe almacenamiento en disco.

**Estado:** necesidad de pantalla [CONFIRMADO por frontend]; diagnóstico de equivalencia y solución técnica [INFERIDO razonable]; política no acordada [REQUIERE VALIDACION DE NEGOCIO].

#### G07 — P1 — Checklist y verificación no mantienen cumplimiento como la ficha frontend

**Evidencia:** `components/views/ObligacionFicha.tsx:109`; `src/modules/contracts/obligaciones.service.ts:55`; `src/modules/contracts/obligaciones.service.ts:89`.

**Brecha:** Front toggle/alta recalcula porcentaje y estado; verificar fija Cumplida/100 con verificadoPor y verificadoFecha (acepta menos de 100 tras confirmación). API usa hecho en vez de listo, guarda ítem sin recalcular y verificar cambia estado/obs sin porcentaje ni metadatos.

**Acción:** Definir comando atómico, recalcular al cambiar checklist y persistir identidad/fecha de verificación. Validar política de aprobación con evidencia; adaptar detalle separado a objeto de ficha.

**Estado:** necesidad de pantalla [CONFIRMADO por frontend]; diagnóstico de equivalencia y solución técnica [INFERIDO razonable]; política no acordada [REQUIERE VALIDACION DE NEGOCIO].

#### G08 — P1 — No se garantiza plazo subcontratado ni reglas condicionales de modificación

**Evidencia:** `src/modules/contracts/child-collections.service.ts:230`; `src/modules/contracts/children.dto.ts:222`; `src/engines/modification.engine.ts:49`.

**Brecha:** API subcontracts valida suma monetaria pero no fin≤fin principal ni orden de fechas; DTO Min(0) permite cero donde front exige >0. Modificación permite omitir fechaNueva/valorNuevo/nuevoTexto; motor puede no cambiar nada o reducir plazo con tipo Prórroga.

**Acción:** Aplicar validación por tipo y datos actuales del padre dentro del comando; adoptar como bloqueo solo reglas ya aprobadas. Probar reducción, prórroga, cesión, supervisor, suspensión y fin subcontrato.

**Estado:** necesidad de pantalla [CONFIRMADO por frontend]; diagnóstico de equivalencia y solución técnica [INFERIDO razonable]; política no acordada [REQUIERE VALIDACION DE NEGOCIO].

#### G09 — P1 — Actuaciones compuestas y anulación de efectos sin equivalencia

**Evidencia:** `components/expediente/forms/SuspensionForm.tsx:66`; `components/expediente/forms/ReinicioForm.tsx:78`; `components/expediente/TabModificaciones.tsx:35`; `src/modules/contracts/child-collections.service.ts:265`.

**Brecha:** SuspensionForm/ReinicioForm insertan modificación+acta y actualizan estado; crearModificacion API inserta modificación+contrato+auditoría, no acta automática. Front tiene reversión parcial al anular determinadas modificaciones; API void no revierte el contrato.

**Acción:** Acordar si acta automática es registro o documento legal y definir comando compuesto idempotente. Resolver reversión/reconstrucción por secuencia y no solo restaurar un valor anterior que podría tener cambios posteriores.

**Estado:** necesidad de pantalla [CONFIRMADO por frontend]; diagnóstico de equivalencia y solución técnica [INFERIDO razonable]; política no acordada [REQUIERE VALIDACION DE NEGOCIO].

#### G10 — P1 — Optimistic lock no atómico y sumas concurrentes

**Evidencia:** `src/modules/contracts/child-collections.service.ts:162`; `src/modules/contracts/child-collections.service.ts:276`; `src/modules/companies/companies.service.ts:111`.

**Brecha:** Actualizar hijo compara versión leída pero UPDATE solo filtra id; dos peticiones con misma versión pueden pasar. Crear subcontrato comprueba suma antes de guardar sin serializar; dos altas pueden exceder cap juntas. Efecto de modificación se calcula antes de leer fresh dentro de transacción.

**Acción:** Usar compare-and-swap id+version, bloqueo/transacción por padre para cap y calcular efecto con estado bloqueado; probar carrera. CompaniesService sí usa id+version: no generalizar el defecto a todo el API.

**Estado:** necesidad de pantalla [CONFIRMADO por frontend]; diagnóstico de equivalencia y solución técnica [INFERIDO razonable]; política no acordada [REQUIERE VALIDACION DE NEGOCIO].

#### G11 — P1 — Lectura de catálogos/responsables y reportes bloqueada para roles que los necesitan

**Evidencia:** `src/modules/settings/settings.controller.ts:11`; `src/modules/users/users.controller.ts:12`; `src/modules/reports/reports.controller.ts:15`.

**Brecha:** SettingsController/UsersController tienen Admin global; roles no admin con CREAR necesitan catálogos y responsables del formulario. Reportes JSON exige EXPORTAR, bloquea CONSULTA que posee VER.

**Acción:** Separar opciones de lectura de administración y lectura de reportes de descarga; decidir exposición mínima de usuarios. Testear matriz de roles por endpoints.

**Estado:** necesidad de pantalla [CONFIRMADO por frontend]; diagnóstico de equivalencia y solución técnica [INFERIDO razonable]; política no acordada [REQUIERE VALIDACION DE NEGOCIO].

#### G12 — P1 — CMetrics del expediente y agregados dashboard/gerencia no tienen contrato HTTP completo

**Evidencia:** `src/modules/contracts/contracts.service.ts:108`; `lib/types.ts:491`; `src/engines/metrics.engine.ts:4`.

**Brecha:** API detalle contiene métricas/semáforo/score, pero no replica todos los conteos y estructuras CMetrics: razones [{l,t}], componentes del score, pendientes, obligaciones, docs faltantes, etc. No endpoint agregado dashboard/gerencia; componer listas sin recuperar todas las páginas truncaría totales.

**Acción:** Documentar DTO agregado completo con corte, universo y fórmulas; implementar endpoint o estrategia de composición paginada completa. No asumir GET contracts con pageSize máximo devuelve toda la cartera.

**Estado:** necesidad de pantalla [CONFIRMADO por frontend]; diagnóstico de equivalencia y solución técnica [INFERIDO razonable]; política no acordada [REQUIERE VALIDACION DE NEGOCIO].

#### G13 — P1 — Métricas pueden estar obsoletas y KPI de alertas activas defectuoso

**Evidencia:** `lib/metrics.ts:139`; `lib/metrics.ts:487`; `lib/store.ts:1`.

**Brecha:** MCACHE se conserva por ID y no tiene llamadas de invalidación observadas; cambiar contrato/hijos/configuración o pasar a otro día puede conservar números viejos. P.conAlerta agrupa claves compuestas de alertState por sí mismas y las consulta por c.id.

**Acción:** Durante integración evitar trasladar ese cache al servidor; invalidar por dependencias/día. Definir y contar alertas abiertas reales por contrato con motor, no estados de gestión presentes.

**Estado:** necesidad de pantalla [CONFIRMADO por frontend]; diagnóstico de equivalencia y solución técnica [INFERIDO razonable]; política no acordada [REQUIERE VALIDACION DE NEGOCIO].

#### G14 — P1 — Diferencias de cálculo financiero/temporal y universo de estados

**Evidencia:** `lib/metrics.ts:227`; `src/engines/metrics.engine.ts:112`; `components/views/GerenciaView.tsx:38`.

**Brecha:** Frontend promedio suma por periodo y toma tres periodos; API toma tres registros. Front admite null restante y calcula agotamiento hoy con saldo≤0 incluso sin promedio; API puede dar restante 0/agotamiento null. API excluye ejecuciones anuladas y redondea COP, front suma registros sin ese filtro. Gráficas y gerencia no comparten siempre el mismo universo de padres.

**Acción:** Crear fixture de paridad con múltiples registros por periodo, meses ausentes, anulados, fechas ausentes, saldo negativo y decimales; acordar versión de fórmula y universo antes de usar KPIs para decisiones.

**Estado:** necesidad de pantalla [CONFIRMADO por frontend]; diagnóstico de equivalencia y solución técnica [INFERIDO razonable]; política no acordada [REQUIERE VALIDACION DE NEGOCIO].

#### G15 — P1 — Mapa/reportes geográficos divergen y pueden duplicar valores

**Evidencia:** `lib/metrics.ts:573`; `components/mapa/MapaColombia.tsx (archivo no almacenado)`; `src/modules/geo/geo.service.ts:41`; `src/engines/map.engine.ts:141`.

**Brecha:** Frontend asigna valor completo en cada departamento y suma por región; API región deduplica. Cliente se deriva de NIT; vacío agrupa varios contratos en una clave nacional pero no aparece en clientes departamentales. Front excluye Rechazada; insumos geo API excluye Anulada pero no Rechazada.

**Acción:** Elegir atribución territorial, identidad cliente, fallback Atlántico y tratamiento de rechazadas; fixture multidepartamento/NIT vacío. Etiquetar valores no sumables entre departamentos.

**Estado:** necesidad de pantalla [CONFIRMADO por frontend]; diagnóstico de equivalencia y solución técnica [INFERIDO razonable]; política no acordada [REQUIERE VALIDACION DE NEGOCIO].

#### G16 — P2 — 19 reportes existentes, pero formatos y columnas no son intercambiables

**Evidencia:** `src/modules/reports/reports.service.ts:107`; `components/reportes/catalogo.ts:139`.

**Brecha:** API implementa 19 claves; no es un GAP de catálogo completo. format=csv cae en JSON; DTO columnas/filas y selección/orden/redondeo difieren del renderer cols/rows. Impresión es cliente.

**Acción:** Prueba de contrato para cada clave y columnas de sección 4.5; admitir CSV explícito o documentar generación cliente; rechazar formatos desconocidos.

**Estado:** necesidad de pantalla [CONFIRMADO por frontend]; diagnóstico de equivalencia y solución técnica [INFERIDO razonable]; política no acordada [REQUIERE VALIDACION DE NEGOCIO].

#### G17 — P2 — Lectura individual de hijos falta para URLs directas de edición

**Evidencia:** `src/modules/contracts/child-collections.controller.ts:37`; `src/modules/insurance/insurance.controller.ts:17`.

**Brecha:** PUT y colecciones por contrato existen; no GET individual genérico salvo obligations, ni guarantee/:id/quota/:id. Cargar todo un listado para ubicar ID depende de paginación/permisos.

**Acción:** Añadir GET autorizado por ID o resolver desde contrato con comprobación de pertenencia; no confundir ausencia de detalle con ausencia de CRUD.

**Estado:** necesidad de pantalla [CONFIRMADO por frontend]; diagnóstico de equivalencia y solución técnica [INFERIDO razonable]; política no acordada [REQUIERE VALIDACION DE NEGOCIO].

#### G18 — P2 — Filtros frontend más ricos que la API y paginación heterogénea

**Evidencia:** `src/modules/contracts/child-collections.service.ts:83`; `src/modules/contracts/contracts.service.ts:51`; `components/views/ContratosView.tsx:29`.

**Brecha:** Frontend filtra por texto de número contractual, empresa, tipo, periodo, severidad, departamento/región, condiciones calculadas y soporte según vista. Listado hijos solo contractId/estado/obligationId/q; estado contracts es almacenado, no siempre efectivo. Empresas devuelve total de todos, seguros/usuarios tienen formas distintas.

**Acción:** Diseñar filtros por módulo con semántica equivalente, sort, total y paginación consistentes; recuperar todos los registros para exportar/agregar. No trasladar filtros calculados como enum persistido Vencido.

**Estado:** necesidad de pantalla [CONFIRMADO por frontend]; diagnóstico de equivalencia y solución técnica [INFERIDO razonable]; política no acordada [REQUIERE VALIDACION DE NEGOCIO].

#### G19 — P2 — Catálogos editados y defaults no se reflejan uniformemente

**Evidencia:** `lib/catalog.ts:214`; `components/views/ConfiguracionView.tsx:93`; `src/engines/types.ts:22`.

**Brecha:** CAT() usa defaultCatalogs y omite settings.catalogs; mapa usa configurados; gapPct fallback configuración=15 y seed=20; documentación requerida API fija frente a configurable front.

**Acción:** Definir autoridad y versionar catálogos/parámetros, invalidar derivados y probar cambio. No crear nuevos tipos Otrosí por etiqueta del formulario.

**Estado:** necesidad de pantalla [CONFIRMADO por frontend]; diagnóstico de equivalencia y solución técnica [INFERIDO razonable]; política no acordada [REQUIERE VALIDACION DE NEGOCIO].

#### G20 — P2 — Versiones documentales y archivo real difieren del mock

**Evidencia:** `components/forms/VersionDocumentoForm.tsx:35`; `src/modules/contracts/documents.service.ts:33`; `src/modules/contracts/documents.controller.ts:55`; `src/modules/contracts/children.dto.ts:360`.

**Brecha:** Frontend usa nombres de archivo y ordinal longitud+1; API recibe bytes multipart y lista versiones descendentes. Front último elemento podría ser v1 al consumir API. extracted declarado IsObject pero multipart documenta JSON string y controller parsea después de ValidationPipe.

**Acción:** Ordenar por v o devolver versionActual inequívoca; generar ordinal en transacción; validar multipart/extracted en capa apropiada y tipos/tamaños de archivos acordados.

**Estado:** necesidad de pantalla [CONFIRMADO por frontend]; diagnóstico de equivalencia y solución técnica [INFERIDO razonable]; política no acordada [REQUIERE VALIDACION DE NEGOCIO].

#### G21 — P2 — OCR, notificación y backup son promesas/demo, no servicios completos

**Evidencia:** `src/modules/contracts/documents.controller.ts:112`; `src/modules/contracts/contracts.service.ts`; `components/views/ConfiguracionView.tsx:292`.

**Brecha:** extract devuelve existentes; notify registra auditoría; delegación describe notificar en fase futura. Copia local/importación/restablecimiento de configuración no equivale a restaurar Postgres.

**Acción:** Separar funciones habilitadas de integraciones futuras y acordar proveedor, trazabilidad y política de restauración. No desarrollar backup DB basándose solo en botón demo.

**Estado:** necesidad de pantalla [CONFIRMADO por frontend]; diagnóstico de equivalencia y solución técnica [INFERIDO razonable]; política no acordada [REQUIERE VALIDACION DE NEGOCIO].

#### G22 — P2 — Agenda/calendario sin endpoint agregado ni contrato de corte

**Evidencia:** `components/views/CalendarioView.tsx:36`; `components/views/AgendaView.tsx:22`.

**Brecha:** Eventos se derivan de contratos, obligaciones, entregables, pólizas, pagos, actas y auditoría; modos mes/semana/día y enlaces existen. Leer solo una página de cada módulo perdería eventos.

**Acción:** Definir composición completa o GET agregado por rango/categoría/acceso, zona horaria y fuente estable; no persistir una segunda tabla de calendario sin necesidad.

**Estado:** necesidad de pantalla [CONFIRMADO por frontend]; diagnóstico de equivalencia y solución técnica [INFERIDO razonable]; política no acordada [REQUIERE VALIDACION DE NEGOCIO].

#### G23 — P2 — Estado de empresas y usuarios sin equivalencia de edición/reactivación

**Evidencia:** `components/forms/EmpresaForm.tsx:60`; `src/modules/companies/dto.ts:41`; `src/modules/users/users.dto.ts:4`.

**Brecha:** Estado editable en frontend; DTOs de empresa/usuario no incluyen estado; API void inactiva y empresa Inactiva no se puede editar. Pasar estado desde mock puede descartarse.

**Acción:** Acordar alta/inactivación/reactivación y efectos históricos; endpoint específico o DTO explícito autorizado, manteniendo unicidad y auditoría.

**Estado:** necesidad de pantalla [CONFIRMADO por frontend]; diagnóstico de equivalencia y solución técnica [INFERIDO razonable]; política no acordada [REQUIERE VALIDACION DE NEGOCIO].

#### G24 — P2 — Responsables/campos relacionales no siempre son FK ni datos de catálogo

**Evidencia:** `lib/types.ts:43`; `src/modules/contracts/entities/contract.entity.ts:51`.

**Brecha:** Contratista/NIT, responsable/supervisor, firmantes, aseguradora y algunos planes son texto. La mera coincidencia de nombres no prueba relación companies/users.

**Acción:** Documentar relación canónica y migración de strings a ID solo si negocio lo requiere; mantener snapshot histórico del nombre y permitir búsqueda sin inventar entidades nuevas.

**Estado:** necesidad de pantalla [CONFIRMADO por frontend]; diagnóstico de equivalencia y solución técnica [INFERIDO razonable]; política no acordada [REQUIERE VALIDACION DE NEGOCIO].


### 7.3 Actualización al cierre: caché y proyecciones concurrentes

El working tree del backend incorporó cambios durante la revisión. Se leyeron sus archivos y se documentan aquí. No se modificó ese trabajo ni se comprobó su despliegue. El README todavía describe la base anterior. Existencia en código y mapeo HTTP [INFERIDO razonable]; aceptación y frescura [REQUIERE VALIDACION DE NEGOCIO].

| Incorporación | Evidencia / funcionamiento | Cobertura pendiente |
|---|---|---|
| CacheModule | src/cache/cache.module.ts importado por AppModule; drivers MemoryCacheService y ValkeyCacheService/ioredis según configuración, fallback memoria sin host | No se comprobó conexión Valkey. La implementación existe; no corresponde recomendar construirla de cero. |
| Settings/catálogos | SettingsService.wrap; TTL base 600 s; delByPattern settings:* y settings:catalogos:* al actualizar | Invalidar también proyecciones dependientes de parámetros/catálogos. |
| Geo | GeoService.wrap con geo:departamentos/geo:regiones + JSON.stringify(filtros), TTL base 900 s | No se observó invalidación tras cambios contractuales/pólizas. Sigue calculando con motores, sin consultar las MV nuevas. |
| Reportes | ReportsService cachea format=json con reports:{key}, TTL base 120 s; XLSX/PDF recalculan | Lectura JSON puede diferir de exportación inmediata. Permisos, 19 claves y CSV no cambiaron. |
| Vistas materializadas | Migración 1727910000000-PerformanceIndexesAndMaterializedViews.ts: mv_geo_aggregates por departamento, mv_reports_summary por contrato, mv_dashboard_kpis por GLOBAL/empresa, con índices | Declaradas en código, sin migración ejecutada por este análisis ni instalación verificada. Son tres proyecciones además de las 28 entidades. |
| DashboardRefreshService | src/modules/dashboards/dashboard-refresh.service.ts propone cron 06:05 America/Bogota | AppModule leído no registra/importa este provider ni un módulo que lo contenga. No hay controller dashboard/gerencia al cierre; el nombre de carpeta no acredita endpoint ni cron activo. |

Ambos drivers aplican jitter de aproximadamente ±10% a los TTL. Estos tiempos son valores observados en el código, no recomendaciones ni SLA aprobados.

La MV dashboard usa AVG simple del avance físico; el dashboard frontend pondera por valor. La MV considera incumplimientos estado Abierto, frente a casos no Cerrado/Subsanado del frontend, y pólizas no Anulada sin reproducir exactamente el KPI aprobado/contrato no cerrado. No cubre automáticamente los 14 KPIs y ocho gráficos. Validar las reglas y el corte antes de sustituir motores por estas proyecciones.

#### G25 — P1 — Caché concurrente sin invalidación completa de dominio; proyecciones aún no conectadas

**Evidencia:** src/cache/cache.service.ts, src/modules/geo/geo.service.ts, src/modules/reports/reports.service.ts, src/modules/settings/settings.service.ts, src/modules/dashboards/dashboard-refresh.service.ts y src/app.module.ts.

**Brecha:** se observaron llamadas delByPattern en settings/catálogos, pero no en mutaciones de contratos, pólizas, pagos o hijos. Las lecturas de mapa/reportes pueden quedar obsoletas hasta sus TTL y diferir de exportación fresca. Modificar parámetros no invalida los derivados geo/reports. Refresco/MV no están acreditados como endpoint o cron activo y sus cálculos no equivalen al frontend.

**Acción:** acordar frescura; invalidar dependencias tras mutación confirmada, cambios de parámetros y corte; usar actualizadoEn y un corte común cuando sea necesario. Registrar refresco/proyecciones solo con pruebas de paridad. Aprovechar el cache existente.

**Estado:** necesidad de datos coherentes [CONFIRMADO por frontend]; diagnóstico/solución [INFERIDO razonable]; frescura y fórmulas aceptables [REQUIERE VALIDACION DE NEGOCIO].


## 8. Riesgos, supuestos y decisiones que requieren validación

### 8.1 Registro de decisiones funcionales pendientes

Los siguientes puntos **no están resueltos por el mock ni por un README**. Estado de cada fila: [REQUIERE VALIDACION DE NEGOCIO]. Se propone responsable funcional, no una asignación real.

| ID | Pregunta concreta para negocio | Efecto sobre diseño / aceptación | Referencia |
|---|---|---|---|
| D01 | ¿Login demo solo para desarrollo o habrá SSO corporativo? ¿Quién administra altas, bajas y recuperación? | Proveedor, duración/revocación de sesión y separación de selector demo | G02 |
| D02 | ¿Acceso transversal por rol o restringido a empresa, responsable, supervisor o contrato asignado? | Autorización por recurso, filtros y claves de cache; no inferir tenant | 6, G11 |
| D03 | ¿Qué estados entran en cada KPI? ¿Borrador/Terminado/Liquidado cuentan en portfolio? | Totales y universos constantes entre dashboard/gerencia/reportes | 4, G14 |
| D04 | ¿Valor pagado de control es bruto+IVA o neto desembolsado? ¿Retenciones e IVA se calculan o se capturan? | Modelo monetario, redondeo y definición de KPI; no duplicar pagado | 4.1, 5 Pago |
| D05 | ¿Cuál es la fuente autoritativa del avance físico: contrato, último informe o agregado de entregables? | Sincronización, histórico y cálculo ponderado/simple | G12–G14 |
| D06 | ¿Se admite más de un informe de ejecución por mes? ¿Cómo promediar meses ausentes? | Unicidad, proyección y fixtures; no imponer unique antes del acuerdo | G14 |
| D07 | ¿Cap subcontratado incluye suspendidos, terminados, liquidados o anulados? ¿El plazo no puede exceder principal? | Validación agregada ante altas y modificaciones del principal | G08, G10 |
| D08 | ¿Se puede exceder cupo con advertencia confirmada? ¿Pendiente reserva cupo? ¿Una póliza vencida sigue consumiendo? | Force/autorización, reserva y concurrencia; LIVE_POL front solo Pendiente/Aprobada | 5 Garantía/Cupo |
| D09 | ¿Prórroga puede reactivar Terminado? ¿Reinicio debe exigir estado Suspendido y compensar días automáticamente? | Máquina de estados, fecha efectiva y actuaciones compuestas | G08–G09 |
| D10 | ¿Anular actuación revierte efecto? ¿Cómo tratar actuaciones posteriores, eliminación local y motivos? | Reconstrucción de contrato, trazabilidad y conservación; no borrar documentos legales | G04, G09 |
| D11 | ¿Otrosí es radicado de cualquier modificación o un tipo jurídico diferente? ¿Cláusula equivale a condiciones/obligaciones? | Catálogo aprobado; no crear tipo inexistente | G05, G19 |
| D12 | ¿Adiciones >50% son advertencia interna o restricción aplicable a un régimen particular? | El código solo advierte; no aplicar prohibición legal universal sin validación | 4.6 |
| D13 | ¿Qué constituye verificación de obligación y aprobación de entregable? ¿Se requiere evidencia, checklist 100% y quién puede aprobar? | Estados, permisos y porcentaje; ficha permite confirmar verificación incompleta | G07, 6.4 |
| D14 | ¿Plan se vincula a contrato, incumplimiento, obligación o hallazgo? ¿Qué fecha y estados son canónicos? | FK y transformación de dos formularios; no existe breachId observado | G05, G24 |
| D15 | ¿Company es empresa contratante o también directorio de contratistas? ¿Responsables son usuarios o texto histórico? | Evitar FK/entidades inventadas; guardar identidad y snapshot solo si procede | 3.2, 2.4 |
| D16 | ¿Valor territorial se atribuye completo, proporcional o por sede? ¿Por qué Atlántico por defecto? ¿Clientes se identifican por NIT? | Resultados multidepartamento, total nacional y etiquetas | G15 |
| D17 | ¿CONSULTA puede leer reportes sin exportar? ¿Catálogos y responsables son legibles por creadores no admin? | Política de opciones y de lectura/exportación | G11 |
| D18 | ¿Firmantes es texto, lista de personas o firma electrónica validada? ¿Qué significa En firmas? | Campos/estados de actas; no prometer firma digital | G05 |
| D19 | ¿Qué tipos/tamaños de archivo, retención, custodia, descarga e histórico se requieren? ¿OCR valida o solo asiste? | Seguridad documental, extracción y almacenamiento; nombres de mock no son evidencia real | G06, G20–G21 |
| D20 | ¿Alertas resueltas reaparecen al cambiar umbral/fecha? ¿Nueva es sin gestión o cruce de umbral no visto? | Clave estable, historial de gestión y política de notificación | G13, AlertsService.listar |
| D21 | ¿Reactivar empresa/usuario es permitido y quién lo hace? ¿Qué pasa con contratos y sesiones activos? | Comando autorizado y datos históricos | G23 |
| D22 | ¿Calendario de todos o solo propios? ¿Usuarios sin AUDITAR pueden ver eventos resumidos de auditoría? | Filtrado de eventos por permiso y fuente; no dar bitácora completa por ruta alternativa | 2.4 Calendario |
| D23 | ¿Existe necesidad de periodos elegibles en dashboard/reportes o basta corte actual/12 meses fijos? | Front no demuestra selector temporal; backlog nuevo si se solicita | 4 |
| D24 | ¿Backup/reset de datos de demo debe existir en producción? | No exponer restauración destructiva por equivalencia de botón local | G21 |

### 8.2 Supuestos técnicos explícitos

[INFERIDO razonable]:

1. PostgreSQL/TypeORM y módulos existentes son la base del trabajo; no se propone reemplazo ni creación masiva de tablas. Las 28 entidades físicas están inventariadas.
2. Un endpoint esperado en matriz es necesidad de consumo o adaptación; no todos necesitan nuevos controllers. Consultar colecciones existentes puede ser suficiente si se garantiza totalidad, acceso y coste.
3. Dashboard, gerencia, mapa, agenda, calendario, reportes, matriz de riesgo, cobertura por aseguradora y ControlScore son **proyecciones**, no entidades que obliguen a persistir tablas nuevas.
4. Revalidación server cubre payload enviado fuera de UI. Inputs, Link/PermissionGate y validación TypeScript no aseguran integridad ni permisos de API.
5. Fechas ISO deben interpretarse con corte operativo explícito. Front mezcla hoy local y `toISOString` UTC para defaults; definir Colombia/zona institucional sin cambiar silenciosamente fechas de negocio. Los 12 meses incluyen el actual.
6. Importes son números JavaScript del mock frente a transformadores monetarios/round del API. Precision de base, impuestos, redondeo por componente y moneda requieren decisión; COP no prueba soporte contable multimoneda porque el control cur es visible.
7. Version de DB mock, ordinal de versión documental y optimistic-lock version de registro son tres conceptos distintos; no reutilizar un mismo número.
8. Errors, vacíos, acceso prohibido, padre/registro inexistente y URL directa deben tener contrato predecible. Las rutas nuevas pueden abrir sin haber cargado un listado.
9. No se infirió cadencia real de envío de correos por la existencia de alertDays. Hay cálculo y marcas persistidas; notificaciones son fase futura.
10. Auditoría de servidor debe producirse desde contexto autenticado; el freeze del front no demuestra inmutabilidad legal. El backend cuenta con cadena/hash y restricción de persistencia; validar operación/retención sin permitir eventos escritos libremente por navegador.

### 8.3 Cache: dependencias y riesgos de invalidación

Implementación frontend confirmada: Store en memoria/localStorage y MCACHE por contractId. Frontend sin integración HTTP; backend con CacheModule memoria/Valkey, TTL base settings=600 s, geo=900 s y reportes JSON=120 s, con jitter observado. No se comprobó despliegue. **No conservar MCACHE indefinidamente en una aplicación conectada.** La sugerencia es [INFERIDO razonable]; TTL y mecanismo a decidir según volumen y frecuencia, sin Redis obligatorio.

| Proyección / recurso | Clave propuesta | Invalidar al cambiar | Riesgo / estado |
|---|---|---|---|
| Detalle/métricas contrato | ID + versión de contrato/hijos + corte + permisos | Contrato, ejecución, pago, obligación/checklist, entregable, garantía, riesgo, incumplimiento, documento, modificación y parámetros | Cambiar hijo sin versión de padre deja dato viejo; dependencias deben explicitarse. [INFERIDO razonable] |
| Dashboard/Gerencia | Alcance autorizado + corte + versión de datos + filtros aprobados | Todas las entidades contribuyentes y parámetros; cambio de día | No cachear primero y filtrar permisos después. [INFERIDO razonable] |
| Mapa/reportes territoriales | Filtros completos + corte + acceso | Contrato/departamentos/empresa/pólizas/cupos y catálogos | Doble conteo e identidad vacía no se arreglan con cache. [INFERIDO razonable] |
| Reportes financieros/control | Clave + formato/filtros/corte/acceso | Entidades indicadas en 4.5 | No agregar solo primera página; lectura y exportación coherentes. [INFERIDO razonable] |
| Alertas y badge | Corte + configuración + alcance + versión de gestión | Mutación dominio, read/delegate/resolve, tarea, cambio de fecha/umbral | Nueva/cruce y gestión son dimensiones diferentes. [INFERIDO razonable] |
| Agenda/Calendario | Rango + tipos + acceso | Fechas y estados de fuentes; auditoría solo si autorizada | Cambio de permisos debe quitar eventos sensibles. [INFERIDO razonable] |
| Catálogos/opciones | Nombre + revisión + alcance | Escritura administrativa; activación/inactivación de usuarios/empresas | Una lista para selección no debe quedar obsoleta tras cambios. [INFERIDO razonable] |
| Documento/versiones/URL | ID + máximo v + acceso | Nueva versión/anulación/corrección; expiración de firma | URL firmada no debe cachearse más allá de exp; no implica TTL general. [INFERIDO razonable] |
| Auditoría | Cursor/rango + acceso | Nuevos eventos | Append-only; no cache compartida que omita historial reciente. [INFERIDO razonable] |

### 8.4 Límites de evidencia

[CONFIRMADO por frontend] para lo leído: 74 páginas y todos los componentes funcionales vinculados enumerados; el mock puede variar con localStorage del usuario, que no fue leído. La revisión es estática del working tree con cambios concurrentes; no asegura una captura funcional ni que todas las interacciones hayan corrido correctamente. Hallazgos de SQL/autorización/concurrencia se deducen del flujo de código, sin pruebas contra una BD ni reproducción HTTP. Las reglas legales, firmas, integraciones financieras, calendarios externos, multi-tenant y SLA no están confirmados. No se tomaron ni incorporaron capturas, no se ejecutó QA ni se alteró código.

## 9. Orden sugerido de trabajo del backend

Las prioridades siguientes son propuestas [INFERIDO razonable], sujetas a decisiones D*. Aprovechar CRUD, reportes, geo y CacheModule existentes, y completar invalidación y conexión de proyecciones descritas en 7.3.

| Orden | Prioridad | Trabajo y dependencias | Criterio de aceptación sugerido |
|---|---|---|---|
| 1 | P0 | Resolver identidad demo/productiva (D01/D02) y cerrar bypass de aprobación al crear pago (G01). Revisar caminos equivalentes de estados sensibles. | Sin APROBAR ninguna alta/edición puede dejar Aprobado/Pagado; casos negativos por rol. Login productivo valida identidad real si se habilita producción. |
| 2 | P1 | Corregir búsqueda por colección y anulación genérica (G03/G04); fijar enums de anulación y permisos con conservación histórica. | q funciona en 10 colecciones; anulación normal registra motivo/auditoría y segunda anulación es idempotente o conflicto documentado. |
| 3 | P1 | Acordar DTO canónico, aliases y estados (G05, D11/D14/D18/D21); documento de errores/paginación/filtros. Separar lectura de opciones y reporte JSON de administración/exportación (G11). | Payloads de los 32 formularios tienen destino definido; no se pierden campos silenciosamente; matriz de 8 roles pasa pruebas de acceso. |
| 4 | P1 | Integridad de plazos/cap y modificaciones condicionales (G08); versionado compare-and-swap y concurrencia por padre (G10). | Fechas inválidas rechazan con campo; dos escrituras con misma versión producen un conflicto; altas concurrentes no exceden cap aprobado. |
| 5 | P1 | Comandos de suspensión/reinicio/prórroga y política de reversión/anulación (G09, D09/D10), transacciones e idempotencia. | Modificación+efecto+acta si corresponde+auditoría se aplican o revierten juntos; reintento no duplica actuación. |
| 6 | P1 | Lectura documental global/detalle, emisor firma y adaptación de versión máxima/multipart (G06/G20); metadatos aprobados. | URL directa documento/versionar funciona con usuario autorizado; descarga conserva autenticación/exp; histórico y archivo actual correctos. |
| 7 | P1 | Ficha de obligación, checklist/cumplimiento/verificación autor/fecha (G07, D13); coherencia de estados de entrega/pagos/seguros. | Toggle/alta recalcula resultado acordado, verificación persiste identidad y fecha, evidencia/soporte accesible con permisos. |
| 8 | P1 | Motor/DTO de métricas y universos aprobados (G12–G15); agregado dashboard/gerencia o composición completa; autoridad avance físico, KPI alertas y corte. | Fixture común verifica 14 KPIs, 8 gráficos dashboard, 8 KPIs/3 gráficos gerencia, razones/score y casos límite; resultados trazables. |
| 9 | P1/P2 | Atribución geo, clientes/territorios y catálogo autoridad (D16, G15/G19); endpoints de lectura por ID, filtros server y paginación (G17/G18). | Multi-departamento, NIT vacío y rechazo no duplican ni ocultan resultados contra definición acordada; acceso directo no depende de lista ya cargada. |
| 10 | P2 | Paridad de 19 reportes, CSV/formatos y permisos (G16), calendario/agenda por rango y audit access (G22), alertas/tareas y estado de gestión. | Prueba por las 19 claves y columnas, dataset íntegro al exportar; eventos correctos por tipo/rango/rol; tarea y alerta consistentes. |
| 11 | P2 | OCR, correo/notificaciones e integraciones solo tras validar alcance/proveedor; backup operativo separado del reset demo (G21). | UI/contrato distinguen disponible de futuro; logs y auditoría de entrega real si se implementa; restauración tiene política aprobada. |
| 12 | P2 | Medir volumen y aplicar cache/invalidation según 8.3, índices de filtros y agregados; documentación OpenAPI y criterios de despliegue. | Resultados permanecen coherentes tras mutación/cambio de día/permisos; metas de latencia y retención acordadas, sin TTL inventado. |

### 9.1 Paquete de pruebas funcionales recomendado (no ejecutado en esta tarea)

- Contratos: borrador con Media frente a Alta, unicidad número, fin<inicio, IVA advertido y reducción excesiva; diferencias entre datos de borrador y DTO persistido.
- Subcontratos: alta/edición cap, cero/negativos, fin fuera de principal, anulado, reducción posterior del padre y concurrencia.
- Modificaciones: cada tipo aprobado, campos condicionales, dirección de fecha/valor, estado origen, reintentos y anulación con actuaciones posteriores.
- Pagos: neto, redondeo, permisos de alta/edición/aprobar/pagar, soporte y diferencia bruto+IVA versus neto en informes.
- Obligaciones: checklist vacío/estándar/custom, toggle/alta, verificación incompleta confirmada, autor/fecha, evidencia y contrato anulado.
- Documentos: carga real, archivo/categoría/nombre, versions orden, emisor y caducidad de firma, acceso directo, anulación e extracted multipart.
- Todas las colecciones: buscar q, filtros propios, paginación completa, detalle por ID, conflicto de versión y auditoría.
- Roles: ocho perfiles, catálogos/opciones, reportes VER/EXPORTAR/AUDITAR, descarga y eventos de auditoría; verificar que ningún canal alternativo eluda acceso.
- Métricas y mapa: fechas nulas, estados almacenados/efectivos, múltiples informes por mes, meses sin ejecución, saldo negativo, multidepartamento y NIT vacío.
- Reportes: 19 claves, orden/nombres de columnas de 4.5, universo, redondeo, formatos y exporte completo; calendario mes/semana/día y ventanas de agenda.

### 9.2 Control de cobertura del análisis

| Evidencia revisada | Cantidad / alcance |
|---|---|
| Páginas app/(app) | 73 |
| Página app/login | 1 |
| **Total vistas de ruta analizadas** | **74** |
| Variantes de reporte dentro de una ruta dinámica | 19 claves r_* |
| Pestañas de expediente | 17 |
| Pestañas de configuración | 6 |
| Formularios dedicados | 32 = 16 globales +16 expediente |
| Interfaces frontend inventariadas | 25, incluidas estructuras/derivados |
| Entidades físicas backend inventariadas | 28 +3 vistas materializadas declaradas en cambio concurrente (despliegue sin comprobar) |
| Hallazgos accionables de equivalencia/integridad | 25 (G01–G25) |
| Código modificado | Ninguno; entregable exclusivamente documental |

