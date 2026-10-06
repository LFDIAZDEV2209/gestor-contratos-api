# Nexo · Gestor Integral de Contratos — API (backend)

Backend REST de la plataforma de gestión de contratos. Implementa el modelo de
datos de `files/02`, los endpoints de `files/03` y las reglas de negocio de
`files/05` **ejecutadas en el servidor** (la interfaz no es la fuente de verdad).

> **Nota de etapa:** este backend todavía **no está integrado** con
> `gestor-contratos-front` (el front sigue con sus datos mockeados). La conexión
> se hará en una etapa posterior, cuando se decida.

## Stack

| Pieza | Elección |
|---|---|
| Framework | NestJS 11 (Express) |
| Lenguaje | TypeScript 5.7 en modo `strict` |
| BD | PostgreSQL 16 (docker-compose) |
| ORM | TypeORM 0.3 con **migraciones** (nunca `synchronize`) |
| Validación | class-validator / class-transformer |
| Docs | OpenAPI (Swagger UI en `/api-docs`) |
| Exportes | ExcelJS (xlsx) + PDFKit (pdf) en servidor |
| Tareas | `@nestjs/schedule` (worker diario de alertas, 6:00 a. m.) |
| Tests | Jest (motores de negocio) |

## Puesta en marcha

Requisitos: Node ≥ 20, pnpm, Docker (para la BD).

```powershell
# 1) Dependencias
pnpm install

# 2) Base de datos (PostgreSQL 16 en el puerto 5433 del host)
pnpm db:up        # docker compose up -d db

# 3) Esquema (migraciones) y datos demo con fechas relativas a hoy
pnpm migration:run
pnpm seed

# 4) Arrancar
pnpm start:dev    # desarrollo con recarga (http://localhost:4000/api)
# o
pnpm build && pnpm start:prod
```

Sin Docker: levanta un PostgreSQL 16 local (o apunta a uno remoto) y ajusta
`.env` (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`). El
docker-compose queda listo para cuando esté disponible.

### Variables de entorno (`cp .env.example .env`)

| Variable | Defecto | Uso |
|---|---|---|
| `PORT` | 4000 | Puerto HTTP |
| `DB_HOST/PORT/USER/PASSWORD/NAME` | localhost / 5433 / gestor / — / gestor_contratos | Conexión PostgreSQL |
| `JWT_SECRET`, `JWT_EXPIRES` | — / 12h | Firma de tokens (demo; en producción SSO OIDC, ver `files/10`) |
| `CORS_ORIGIN` | http://localhost:3000 | Orígenes permitidos (front en desarrollo) |
| `ALERT_CRON` | `0 6 * * *` | Recálculo diario de alertas |
| `UPLOAD_DIR` | ./data/uploads | Archivos de documentos (blob storage real en fase 2) |
| `DEFAULT_PAGE_SIZE` | 25 | Paginación por defecto |

## Autenticación (demo)

No hay contraseñas en esta fase: el login corporativo OIDC se conecta en la
fase 1 (según `files/10`). Para probar:

```powershell
$login = Invoke-RestMethod -Uri http://localhost:4000/api/auth/login -Method Post -ContentType 'application/json' -Body '{"email":"lmendez@empresa.co"}'
# → { token, usuario, permisos }
# Usar en cada request: Authorization: Bearer <token>
```

Usuarios sembrados (files/11): `lmendez@empresa.co` (ADMINISTRADOR),
`jperez@empresa.co` (CONTRATACIÓN), `crios@empresa.co` (JURÍDICA),
`agomez@empresa.co` (FINANCIERA), `msalcedo@empresa.co` (SUPERVISOR),
`rortiz@empresa.co` (INTERVENTOR), `dcastro@empresa.co` (AUDITOR),
`pllanos@empresa.co` (CONSULTA).

En producción, el login demo se habilita con `AUTH_DEMO_LOGIN=1` en la taskdef
ECS, según la decisión D0004, para permitir la demostración integrada mientras
se conecta SSO OIDC. Sin ese valor exacto, producción responde `503 AUTH_SSO_PENDING`.
La migración `1730800000000-DemoSeedData` siembra los datos demo dentro de la
transacción de TypeORM únicamente si no hay usuarios. `pnpm seed` reutiliza
la misma función idempotente; revertir la migración conserva los datos.

## Convenciones de la API (files/03)

- **Base:** `http://localhost:4000/api`. JSON UTF-8; fechas `AAAA-MM-DD`; dinero entero en COP.
- **Paginación:** `?page=1&pageSize=25` → `{ data, total, page, pageSize }`.
- **Filtros:** por campo (`?estado=Activo&companyId=EMP-01&depto=08&region=Caribe&nivel=critico…`).
- **Sin borrado físico:** no hay `DELETE`; la anulación es `POST /…/:id/void` con `{ motivo }` y queda en auditoría.
- **Concurrencia:** cada registro lleva `version`; un `PUT` desactualizado responde **409**.
- **Advertencias aceptables:** **422** con `warnings[]`; se aceptan reenviando con `?force=true` («Registrar de todas formas»).
- **Errores:** `{ "error": { "code", "message", "fields?" } }`.
- **Auditoría:** cada POST/PUT/void/validación/conciliación/exportación genera registros del lado del servidor con usuario, rol y **IP real** del request (tabla `audit_log` **INSERT-only**: un trigger de BD bloquea UPDATE y DELETE; hash encadenado por registro).

### Resumen de rutas

| Dominio | Rutas |
|---|---|
| Auth | `POST /auth/login` · `GET /me` |
| Empresas | `GET/POST /companies` · `GET/PUT /companies/:id` (con indicadores) · `POST /companies/:id/void` |
| Contratos | `GET/POST /contracts` · `GET/PUT /contracts/:id` · `POST /contracts/:id/void` · `POST /contracts/:id/validate` · `GET /contracts/:id/reconcile` · `GET /contracts/:id/timeline` · `GET /contracts/:id/audit` · `POST /contracts/:id/notify` |
| Colecciones hijas (12) | subcontracts, obligations (+`/checklist`, `/comments`, `/evidences` multipart, `/verify`), deliverables, execs, payments (+`/approve`, `/pay`), guarantees (+`/approve`), actas, modifications (inmutables), risks, breaches, plans (+`/extracted` en documents) — patrón `GET /x`, `GET /contracts/:id/x`, `POST /x`, `PUT /x/:id`, `POST /x/:id/void` |
| Seguros | `GET /guarantees?aseguradora=&modalidadPoliza=&cupoId=&vencenEnDias=` · `GET /insurers` · `GET /insurers/:nombre/policies` · `GET/POST /quotas` · `PUT /quotas/:id` · `POST /quotas/:id/void` |
| Alertas y tareas | `GET /alerts?nivel=&estado=` · `POST /alerts/:key/read|resolve|delegate|tasks` · `POST /alerts/recalc` · `GET /tasks` · `PUT /tasks/:id` |
| Mapa | `GET /geo/departments?metric=contratos|polizas|clientes&measure=n|v` · `GET /geo/regions` |
| Reportes | `GET /reports/:key?format=json|xlsx|pdf` (19 claves: `r_general` … `r_sup`) |
| Auditoría | `GET /audit?usuario=&contractId=&desde=&hasta=&accion=&modulo=&campo=` (solo lectura) |
| Sistema | `GET/PUT /settings` · `GET/PUT /catalogs/:nombre` · `GET/POST/PUT /users` · `GET/PUT /roles/permissions` (solo ADMINISTRADOR) |

> Las claves de alertas llevan `|` (p. ej. `gar|GR-07|15`); al llamar
> `POST /alerts/:key/…` codifícalas (`%7C`) — el servidor las decodifica.

## Motores de negocio (en servidor)

`src/engines` — funciones puras y probadas (los endpoints nunca aceptan métricas del cliente):

- **`calcularMetricas` (M(c))**: valor inicial/actualizado, ejecutado, pagado, saldo, %, días transcurridos/restantes, promedio de los últimos 3 periodos, fecha de agotamiento de recursos.
- **`calcularSemaforo`**: peor nivel de 18 factores (Normal/Atención/Riesgo/Crítico/Sin información) con razones.
- **`calcularControlScore`**: índice 0–100 (docs 20 %, obligaciones 20 %, ejecución 15 %, garantías 15 %, pagos 10 %, riesgos 10 %, auditoría 10 %).
- **`calcularAlertas` / `calcularAlertasCupos`**: 16 tipos de alerta con claves estables (`contrato|CT-01|30`, `gar|GR-07|15`, `cupo|CP-03|85`) — una alerta por umbral cruzado.
- **Validador** (`validarContratoCompleto`, `validarBorrador`): 13 áreas con severidad Alta (bloquea, 400) / Media-Baja (advertencia, 422).
- **`conciliar`**: conciliación sistema vs. documento firmado (valor ±1 COP, fechas, plazo, objeto, contratista, NIT, garantías).
- **`cupoStats`**: utilizado (Aprobadas/Pendientes de contratos no anulados), disponible y % de uso.
- **Agregados del mapa**: por departamento y por región sin duplicar contratos multicobertura.

## Reglas del servidor (aplicadas en los endpoints)

- `Validator.draft` se re-ejecuta en `POST/PUT /contracts` (sin confiar en el cliente).
- Subcontratos: la suma no supera el valor del contrato; ninguno termina después del principal.
- Ejecución: acumulado > valor actualizado ⇒ advertencia aceptable; avance físico ≤ 100.
- Pagos: `neto = bruto + iva − retenciones` (calculado en servidor); aprobar/pagar exige permiso APROBAR.
- Garantías por cupo: misma aseguradora, cupo Vigente, disponible suficiente y vigencia compatible (errores 400, advertencias 422 con `force`).
- Cupos: editar con valor < utilizado ⇒ advertencia; con pólizas no cambia aseguradora.
- Utilizado = pólizas Aprobadas/Pendientes de contratos no anulados (anuladas/rechazadas liberan cupo).
- Anulación de contrato conservada en auditoría; no hay borrado físico.

## Worker diario

`AlertsWorker` (cron `0 6 * * *`, zona `America/Bogota`) re-ejecuta el cálculo
de alertas y marca las claves nuevas por cruce de umbral (base para las
notificaciones por correo/WhatsApp de la fase 3). También se puede forzar con
`POST /api/alerts/recalc`.

## Tests

```powershell
pnpm test        # motores de negocio (90 aserciones)
```

Cubre: fórmulas de M(c) (valores, saldos, porcentajes, fechas, agotamiento),
semáforo (18 factores, casos especiales, peor nivel), alertas (16 tipos, claves
estables, umbral por cruce), validador (áreas y severidades), conciliación,
cupos, agregados del mapa y efectos de las modificaciones.

## Estructura

```
src/
├── main.ts                      # Bootstrap: Swagger, CORS, ValidationPipe
├── app.module.ts                # Composición (el CRUD genérico va al final)
├── config/configuration.ts      # Env validado
├── common/                      # Excepciones, filtro global, guards, permisos, diff de auditoría
├── database/
│   ├── data-source.ts           # DataSource CLI (migraciones)
│   ├── migrations/              # Esquema inicial (28 tablas) + trigger INSERT-only
│   └── seed/                    # Datos demo (files/11) con fechas relativas
├── engines/                     # M(c), semáforo, alertas, validador, conciliación, cupos, mapa
└── modules/
    ├── auth/                    # JWT (demo), /me
    ├── users/                   # Usuarios (ADMINISTRADOR)
    ├── companies/               # Empresas + indicadores
    ├── contracts/               # Contratos + 12 colecciones hijas + expediente
    ├── insurance/               # Garantías, aseguradoras, cupos
    ├── alerts/                  # Alertas + tareas + worker
    ├── audit/                   # Bitácora solo lectura
    ├── settings/                # Parámetros + catálogos
    ├── geo/                     # Agregados del mapa
    ├── dashboards/              # Refresh programado de materialized views
    └── reports/                 # 19 reportes json/xlsx/pdf
```

## Caché (Valkey) y dashboards

- **Abstracción `src/cache`**: `CacheService` con driver `valkey` (ioredis, compatible con ElastiCache for Valkey) o `memory` fallback — cambio de entorno solo por `.env` (`CACHE_DRIVER`, `VALKEY_HOST/PORT/PASSWORD/TLS`).
- **TTLs por caso**: settings/catálogos 10 m (invalidación al escribir), geo 15 m, reportes JSON 2 m, KPIs del dashboard 60 s. Namespace `nexogc:<env>:*`, jitter 10 %, guard anti-stampede (single-flight + lock NX).
- **Materialized views** (`mv_geo_aggregates`, `mv_reports_summary`, `mv_dashboard_kpis`) con refresh CONCURRENTLY programado 06:05 America/Bogota (`DashboardRefreshService`) — ver `docs/BASE_DATOS.md` y `docs/CACHE.md`.

## Observabilidad

- Logging JSON estructurado con `requestId`/`userId`/rol/status/duración; redacción de password/token/secret.
- `GET /api/health/live` (liveness ALB/ECS) · `GET /api/health/ready` (DB + caché).
- Slow queries TypeORM > 500 ms con warn. Detalle: `docs/OBSERVABILIDAD.md`.

## Infraestructura local y AWS

- Local: `docker compose up -d` → PostgreSQL 16 (`localhost:5433`) + Valkey 8 (`localhost:6380`, auth/AOF/allkeys-lru).
- AWS: scripts idempotentes `infra/aws/01..09` — VPC 2 AZ (DMZ/ALB+NAT, app privada, data aislada), RDS PostgreSQL, ElastiCache Valkey, WAF (managed COUNT + rate limit), S3 privado, Secrets Manager, ECS Fargate, alarmas CloudWatch. Ver `docs/AWS.md`.

## Roadmap de conexión (fases del plan)

- **Fase 1:** SSO OIDC (Azure AD/Keycloak), recalcular alerts en worker con notificaciones, IP real ya implementada.
- **Fase 2:** blob storage S3 con URLs firmadas (abstracción de storage ya preparada, ver `.env` S3_*).
- **Fase 3:** recálculo programado + notificaciones SMTP/Graph.
- **Fase 4:** WhatsApp + tiempo real (SSE/WebSockets).
- **Fase 5:** OCR (`POST /documents/:id/extract`), PDF oficial y Excel en servidor (xlsx ya servido por API).
