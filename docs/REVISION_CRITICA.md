# Revisión crítica de arquitectura, seguridad y performance

Fecha: 2026-10-05. Backend únicamente; frontend sin intervenir.

## Alcance y evidencia

Snapshot revisado: `a8e8a733c6238d7a878c5e8697fce0b26c2e8f35`, rama `main`. Se ejecutó `git log --stat -7` y se inspeccionaron los cambios de cada uno de los seis commits solicitados:

| Commit | Alcance |
| --- | --- |
| `4333e79` | Drivers de caché, configuración, settings, geo, reportes, dependencias y pruebas. |
| `8ff2c36` | Observabilidad HTTP/TypeORM, correlation-id, health y bootstrap. |
| `516816d` | Índices, tres vistas materializadas, servicio de refresh y registro del módulo. |
| `47b76d6` | Aprovisionamiento/despliegue AWS, documentación y configuración Nest/pnpm. |
| `c1ad6b2` | Documentación de caché y observabilidad. |
| `a8e8a73` | README. |

`fc29056` es el séptimo commit de contexto y no forma parte de los seis cambios revisados. Durante la revisión hubo nuevas modificaciones y commits externos: no se incluyen en este dictamen ni se sobrescriben. Las líneas de infraestructura corresponden a los scripts **commiteados en `47b76d6`**, aunque posteriormente hayan sido corregidos. Los problemas preexistentes se identifican expresamente.

CodeGraph se inicializó con autorización (`codegraph init -i`: 146 archivos, 2.468 nodos, 5.148 aristas). Su consulta de callers confirma que `delByPattern` solo se invoca desde las tres escrituras/seed de settings; no desde las fuentes de geo/reportes. No encontró `ScheduleModule`.

Verificación realizada:

- `pnpm exec tsc --project tsconfig.build.json --noEmit --incremental false`: sin errores.
- Jest focalizado: caché memoria, Valkey y settings; 3 suites y 13 pruebas pasan en el workspace. La prueba de settings usa `test/mocks.ts`, que no estaba commiteado en el snapshot original; el resultado local no acredita que ese snapshot sea autosuficiente en CI.
- Comprobaciones transitorias en Node/ts-node, sin editar código: fallo del lock de Valkey impide invocar el factory; entrada expirada permanece en memoria si no vuelve a leerse; un factory anterior repuebla después de invalidar; log HTTP de error conserva status 200, omite el usuario autenticado y deja visible un secreto en query string.
- Comprobación aislada de interpolación PowerShell: `"$ecrUri:latest"` produce cadena vacía y `"$execSecretDb:username::"` produce `::` con variables ordinarias.
- No se ejecutaron scripts AWS, migraciones ni refresh contra una base de datos. No se midieron planes `EXPLAIN ANALYZE`, latencias reales ni tamaños de tablas. El diagnóstico de índices es estructural, no un benchmark.

## Hallazgos criticos

**11 hallazgos bloqueantes: 1 P0 condicionado al despliegue público y 10 P1.** Se requiere corregirlos o retirar explícitamente del despliegue las capacidades afectadas.

### C01 — P0: el despliegue público expone login de demostración sin credenciales

**Ruta:** `src/modules/auth/auth.service.ts:27`, `src/modules/auth/auth.controller.ts:19`; exposición nueva en `infra/aws/07-waf-alb.ps1:56`.

`login(email)` busca un usuario activo y firma un JWT sin contraseña ni identidad corporativa verificada. Conocer el correo de un administrador basta para asumir su rol. **El login es preexistente**, pero los nuevos scripts publican esta API en un ALB accesible desde Internet; no hay bloqueo por `NODE_ENV=production`.

**Fix concreto:** deshabilitar el login demo en producción antes de exponer el ALB; habilitar un mecanismo real de autenticación (OIDC validado o credenciales verificadas). Mientras tanto, restringir el acceso a un entorno privado de demostración. Verificar que un correo por sí solo no permite obtener un token en producción.

### C02 — P1: tráfico de autenticación y contratos en HTTP público

**Ruta:** `infra/aws/07-waf-alb.ps1:56`.

El único listener creado reenvía HTTP:80 directamente al target group. HTTPS se deja como pendiente. Un JWT Bearer y datos contractuales pueden viajar sin cifrado cuando se utiliza la URL desplegada; CORS no protege ese transporte.

**Fix concreto:** crear listener HTTPS:443 con ACM y redireccionar 80 a 443; impedir la publicación de tráfico autenticado hasta tenerlo. Confirmar mediante una petición HTTP que la respuesta es una redirección y no contenido de la API.

### C03 — P1: una caída de Valkey rompe el supuesto best effort

**Ruta:** `src/cache/valkey-cache.service.ts:89`, `src/cache/valkey-cache.service.ts:105`; selección del driver en `src/cache/cache.module.ts:17`.

`get()` absorbe errores, pero `populate()` adquiere el lock con un `SET` sin `catch`. Si falla por desconexión/AUTH/timeout, `wrap()` rechaza antes de llamar al factory: fallan lecturas de settings, geo y reportes. `ready()` devuelve siempre `true`, incluso después de absorber un fallo de conexión. El driver memory solo se selecciona por configuración/ausencia de host; no existe fallback a memoria cuando cae Valkey.

**Fix concreto:** acotar la espera de conexión/comandos, comprobar el estado real y capturar exclusivamente los fallos de infraestructura al adquirir el lock. En ese caso ejecutar el factory con single-flight local; conservar los errores reales del factory. Probar desconexión inicial, desconexión posterior y recuperación, además del happy path.

### C04 — P1: los cron declarados nunca se registran

**Ruta:** `src/app.module.ts:32`, `src/modules/dashboards/dashboard-refresh.service.ts:23`.

No existe importación de `ScheduleModule.forRoot()` en la aplicación. Importar `DashboardsModule` y decorar con `@Cron` no inicializa el scheduler: las vistas quedan con el snapshot de creación y el worker de alertas preexistente tampoco se activa. La documentación promete refresh diario a las 06:05.

**Fix concreto:** registrar `ScheduleModule.forRoot()` una sola vez en el módulo raíz y comprobar en el bootstrap que ambos jobs existen en `SchedulerRegistry`. La activación requerida está documentada por [NestJS](https://docs.nestjs.com/techniques/task-scheduling).

### C05 — P1: memoria sin límite y cardinalidad controlada por la petición

**Ruta:** `src/cache/memory-cache.service.ts:9`, `src/cache/memory-cache.service.ts:22`, `src/modules/geo/geo.service.ts:71`, `src/modules/geo/geo.controller.ts:19`.

Las entradas expiran únicamente cuando se vuelve a pedir esa misma key. No hay barrido, límite de entradas/bytes ni eviction. Geo usa `JSON.stringify` de todo el query recibido: `?irrelevante=1`, `?irrelevante=2`, etc. generan copias completas de agregados aunque el parámetro no afecte el cálculo. Un usuario con `VER`, o tráfico legítimo con filtros únicos, puede mantener crecimiento indefinido y terminar el proceso por OOM cuando el driver es memory.

**Fix concreto:** limitar entradas/bytes con eviction y limpiar expirados; construir keys a partir de un DTO validado con únicamente los filtros admitidos, normalizados y en orden estable. Probar muchas keys únicas y comprobar que el tamaño queda acotado tras expirar.

### C06 — P1: escrituras no invalidan geo/reportes y la invalidación existente tiene carreras

**Ruta:** `src/modules/geo/geo.service.ts:71`, `src/modules/reports/reports.service.ts:114`, `src/modules/settings/settings.service.ts:115`, `src/cache/memory-cache.service.ts:40`, `src/cache/valkey-cache.service.ts:98`.

Crear/editar/anular contratos, colecciones hijas, garantías o cupos no invalida `geo:*`/`reports:*`. Las respuestas pueden mostrar contratos o pólizas anulados hasta aproximadamente 16,5 minutos (geo) y 132 segundos (reportes), por el jitter. Ejemplos de fuentes sin invalidación: `contracts.service.ts:140`, `child-collections.service.ts:111`, `insurance.service.ts:120`. Cambiar parámetros también deja reportes con semáforos anteriores; editar empresas deja nombres anteriores; escribir auditoría deja `r_aud` atrasado.

Además, borrar keys no cancela ni versiona factories pendientes: una lectura anterior puede publicar el snapshot viejo después del borrado. En settings la invalidación ocurre después de auditar; si la auditoría falla tras persistir, tampoco se invalida.

**Fix concreto:** invalidar las familias afectadas después del commit de cada mutación exitosa, incluyendo las rutas de modificación/aprobación/anulación. Usar una generación por familia para que un factory antiguo no pueda publicar en la generación vigente; en despliegue multiproceso debe ser compartida. Coordinar persistencia/auditoría e invalidación para no depender de un paso fallido posterior. Probar lectura cacheada → escritura → lectura y lectura pendiente → escritura → publicación tardía.

### C07 — P1: secretos en URLs atraviesan la redacción

**Ruta:** `src/common/observability/http-logging.interceptor.ts:23`, `src/common/observability/logger.ts:11`.

Se registra `req.originalUrl` íntegro dentro de una propiedad llamada `ruta`. La redacción solo interpreta nombres de propiedades, de modo que `/api/geo/regions?token=...` o `?password=...` queda completo en stdout/CloudWatch. No se afirma que las rutas actuales necesiten tokens en URL; el logger registra cualquier query aportado por el cliente y contradice la política de redacción anunciada.

**Fix concreto:** registrar el pathname o plantilla de ruta; si se requieren queries, parsearlas y aplicar una allowlist/redacción por clave antes de serializar. Evitar mensajes con secretos interpolados. En infraestructura también retirar `Write-Host` de credenciales (`infra/aws/03-secrets-s3.ps1:18`, `:32` y el bloque JWT): mostrarlas una vez sigue filtrándolas a transcripts/CI.

### C08 — P1: conexión PostgreSQL sin TLS frente al RDS desplegado

**Ruta:** `src/app.module.ts:34`, `src/database/data-source.ts:12`, `infra/aws/04b-rds-postcheck.ps1:15`.

Ambos DataSource carecen de configuración `ssl`. Guardar `sslMode=require` en el JSON del secreto no tiene efecto: ECS solo inyecta usuario/password y el código no consume ese campo. Con el parámetro predeterminado de RDS PostgreSQL 16, la conexión sin TLS será rechazada. La ausencia de SSL en código es preexistente; la incompatibilidad aparece con el nuevo despliegue RDS.

**Fix concreto:** compartir configuración TLS entre API, CLI de migraciones y seed; habilitarla en producción con validación de certificado/CA de RDS, conservando la configuración local apropiada. No resolverlo desactivando `rds.force_ssl`. [AWS documenta el valor predeterminado y el rechazo de conexiones sin SSL](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL.Concepts.General.SSL.html).

### C09 — P1: el script ECS no genera un despliegue válido

**Ruta:** `infra/aws/09-ecs-deploy.ps1:7`, `:27`, `:33`, `:40`, `:76`, `:96` (snapshot `47b76d6`).

La interpolación PowerShell consume `$ecrUri:latest` y `$execSecretDb:username` como referencias con scope, produciendo imagen vacía y referencias de secretos rotas. Los sufijos `??????` tampoco son ARNs reales para ECS. La consulta RDS anida incorrectamente `DBInstances[0]` al pedir el puerto; la proyección Valkey produce una lista de listas que se interpreta como lista plana. La llamada AWS dentro del string de `network-configuration` se transmite literalmente.

**Fix concreto:** delimitar variables con `${...}`, obtener ARNs reales con `describe-secret`, corregir la extracción tipada de endpoints/puertos, convertir puertos de environment a string y resolver el SG antes de construir la configuración de red. Usar el endpoint primario para modo no cluster; para modo cluster se requiere un cliente compatible. Validar localmente el JSON generado y cada resultado antes de registrar/actualizar ECS. [Formato oficial de secretos ECS](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/secrets-envvar-secrets-manager.html).

### C10 — P1: el aprovisionamiento DB/Valkey usa opciones CLI inválidas

**Ruta:** `infra/aws/04-rds.ps1:38`, `infra/aws/05-valkey.ps1:26` (snapshot `47b76d6`).

RDS usa `--storage-autoscaling`, que no es una opción de `create-db-instance`; el límite se configura con `--max-allocated-storage`. Valkey usa `--description` y `--automatic-failover-disabled` en lugar de las opciones de esa operación; además no habilita explícitamente `--transit-encryption-enabled` pese a configurar AUTH/TLS. Los scripts continúan y anuncian éxito sin verificar `$LASTEXITCODE`.

**Fix concreto:** eliminar la opción RDS inexistente; usar `--replication-group-description`, `--no-automatic-failover-enabled` y habilitar cifrado en tránsito. Parsear secretos con JSON estructurado, no con regex que supone que las comillas desaparecieron. Verificar el exit code tras cada comando relevante y detener la cadena en el primer error. Contrastar con las referencias de [RDS CLI](https://docs.aws.amazon.com/cli/latest/reference/rds/create-db-instance.html) y [ElastiCache CLI](https://docs.aws.amazon.com/cli/latest/reference/elasticache/create-replication-group.html).

### C11 — P1: configuración WAF rechazada y rate limit prometido ausente

**Ruta:** `infra/aws/07-waf-alb.ps1:15`, `:16`.

Las reglas `ManagedRuleGroupStatement` usan `Action`, cuando corresponde `OverrideAction`. Esto bloquea la creación de la ACL. Adicionalmente no existe ninguna `RateBasedStatement` pese a anunciarse una regla Block de 2000 solicitudes/5 minutos; corregir solo el JSON deja la API sin ese control de abuso.

**Fix concreto:** aplicar `OverrideAction: { Count: {} }` para la observación del grupo y añadir una regla rate-based Block explícita. Verificar creación, asociación y reglas efectivas, deteniendo el script ante errores. [Contrato oficial de Rule en AWS WAF](https://docs.aws.amazon.com/waf/latest/APIReference/API_Rule.html).

## Mejoras recomendadas

### Observabilidad y seguridad

- **Identidad y resultado HTTP incorrectos:** `http-logging.interceptor.ts:20` lee `req.user`, pero `JwtAuthGuard` escribe `req.reqUser`. `catchError` registra el status antes del filtro y puede emitir 200 ante una excepción. Los fallos de guards ocurren antes del interceptor y no se registran allí. Registrar una vez al finalizar la respuesta (`finish`/`close`) desde middleware, tomando `reqUser` y el status definitivo; incluir correlación en el filtro. Caso reproducido, pendiente de prueba de integración HTTP.
- **Correlation-id:** `correlation-id.middleware.ts:11` limita a 128 caracteres y genera UUID si falta. Restringir caracteres permitidos; actualmente acepta identificadores arbitrarios del cliente, por lo que no deben usarse como prueba de identidad. Añadir `exposedHeaders: ['x-request-id']` en CORS si el frontend necesita leerlo.
- **Errores preexistentes:** `all-exceptions.filter.ts:51` y `:63` envían mensajes internos/DB al cliente. Sustituirlos por mensajes públicos estables y registrar diagnósticos sanitizados con requestId. El TypeORM logger elimina parámetros, pero eso no sanitiza automáticamente stacks/mensajes de otros loggers.
- **DTOs:** las clases de contratos/settings tienen decoradores y el pipe global aplica whitelist/transform. Sin embargo, queries `Record<string, unknown>` y bodies con tipos inline no reciben esa validación; usar DTOs reales, especialmente para geo. Acotar tamaño de catálogos y validar enums/fechas en todos los endpoints. No se introdujeron DTOs de escritura nuevos en estos seis commits.
- **Producción:** eliminar localhost de CORS AWS si no es necesario; condicionar Swagger al entorno/acceso previsto y exigir `JWT_SECRET` sin el fallback demo preexistente. CORS es una lista de orígenes, no una barrera de autorización.

### Caché y concurrencia

- `valkey-cache.service.ts:90`: el perdedor del lock espera solo 500 ms y luego calcula aunque el propietario siga activo hasta 10 s. Con factories lentos, cada réplica vuelve a calcular. Usar espera acotada alineada con la duración observada o servir stale aceptable; controlar el lease.
- `valkey-cache.service.ts:101`: lock constante `1` y borrado incondicional. Si expira y otro proceso lo adquiere, el propietario anterior puede borrar el lock nuevo. Usar token único y compare-and-delete atómico; renovar si la operación puede exceder el lease.
- Las keys físicas Valkey sí tienen namespace, pero todos los entornos no production comparten `nexogc:dev:`. Hacer configurable ambiente/instancia y versión de esquema para separar staging, desarrollo y despliegues incompatibles. Memory es local, por lo que no compartir namespace externo no constituye por sí solo una fuga.
- Memory no comparte invalidación entre las dos tareas ECS; definirlo como modo local explícito o implementar coherencia si se permite en producción. `CACHE_DEFAULT_TTL` tampoco configura el driver memory actual.
- Instrumentar errores, hits/misses, tamaños y duración de factories; hoy las excepciones de Redis se absorben silenciosamente. Reconciliar el best effort con `/health/ready`, que considera caché caída como no ready; establecer timeouts para DB/PING.

### Base de datos: índices frente a consultas reales

La migración contiene **39 instrucciones CREATE INDEX**, incluidas las tres UNIQUE de vistas; no 42. No hay índice exactamente duplicado por columnas/orden entre los nuevos y los anteriores, pero hay candidatos a redundancia y varios sin consumidor actual:

| Índice / ruta de migración | Evaluación y acción sugerida |
| --- | --- |
| `(contract_id, created_at DESC)`, líneas 49–134 | Útiles para listados por contrato con ese orden. Los índices anteriores sobre solo `contract_id` son candidatos a retirada tras medir; no borrarlos a ciegas. No resuelven el listado global sin filtro contractId. |
| `ix_contracts_deptos_gin`, línea 18 | Geo lee todas las filas y ContractsService filtra deptos en memoria. No acelera esos filtros actuales. Incorporar operadores JSONB indexables al query si se justifica o posponer el índice. |
| `ix_contracts_contratista`, línea 33 | B-tree no resuelve la búsqueda `ILIKE '%texto%'` de `contracts.service.ts:60`. Evaluar `pg_trgm` con datos/planes antes de añadir otra familia de índices. |
| `ix_contracts_fecha_firma`, línea 23 | Filtro real usa `EXTRACT(YEAR ...)` y ordena en memoria. Preferir rango de fechas parametrizado para aprovechar el índice. |
| `ix_contracts_fecha_inicio`, línea 28 | No se observó predicado SQL de fecha_inicio en los consumidores revisados. Exigir consulta/plan que lo justifique. |
| `ix_contracts_anulado_estado_company`, línea 13 | Alineado con consultas que combinan las tres columnas; para anulado+company sin estado no equivale a un índice diseñado para ese filtro. Medir distribución, índices existentes y alternativas parciales. |
| `ix_guarantees_contract_created`, línea 79 | InsuranceService ordena por fechaVenc; el nuevo índice no satisface ese orden. Medir `(contract_id, fecha_venc)` para ese flujo sin asumir que el índice actual lo cubre. |
| `ix_risks_categoria` / `ix_risks_prob_impacto`, líneas 114/119 | Reportes leen y agrupan en memoria. `(prob, impacto)` no indexa automáticamente el producto `prob * impacto`. Exigir planes antes de conservarlos por una promesa de performance. |
| `ix_tasks_asignado_vence`, línea 150 | `alerts.service.ts:135` lista todas las tareas ordenando estado,vence, sin filtro asignado. No corresponde a esa consulta. |
| `ix_alert_keys_contract_tipo`, línea 155 | Recalcular consulta toda la tabla y otros flujos consultan alertKey; no se observó el predicado contract_id,tipo documentado. |
| `ix_audit_contract_id_desc`, línea 140 | Alineado con consultar auditoría por contrato ordenada por id DESC. |
| `ix_audit_fecha_modulo`, línea 145 | Rango en la primera columna limita la utilidad de la segunda para un módulo; tampoco satisface ORDER BY id. Comparar con `(modulo, fecha)` y con índices separados según los filtros reales. |
| checklist/comentarios, líneas 160/165 | Alineados con lectura por obligación y orden; índices anteriores de solo obligation_id son candidatos a redundancia. |
| Índices secundarios de MVs, líneas 278/396/401/406/531 | No hay consultas consumidoras de las MVs en la API. El de región indexa solo 33 filas. Posponer índices sin consulta demostrada. |

No se debe declarar inútil un índice solo por baja cardinalidad ni retirar un índice anterior solo por compartir prefijo. Confirmar con `EXPLAIN (ANALYZE, BUFFERS)` y estadísticas de uso/costo de escritura representativas.

### Vistas, refresh y arquitectura

- **MVs desconectadas:** `geo.service.ts:27` y `reports.service.ts:140` siguen consultando entidades/motores. Los nombres de vistas aparecen en migración/refresh, sin SELECT consumidor. No se ha logrado la aceleración analítica anunciada. Definir un primer consumidor acotado o posponer el refresh/costo hasta que exista, sin reescribir todos los reportes.
- **DDL bloqueante:** los índices usan CREATE INDEX normal y las vistas WITH DATA se calculan durante la migración. En tablas grandes esto puede bloquear escrituras y alargar el despliegue. Planificar ventana o una migración separada para CREATE INDEX CONCURRENTLY fuera de la transacción global; no basta añadir la palabra CONCURRENTLY a la migración transaccional.
- **Refresh multiproceso:** al corregir C04, las dos tareas ECS ejecutarán el job. PostgreSQL serializa refresh sobre la misma vista, pero se duplica trabajo. Añadir exclusión distribuida (por ejemplo advisory lock con conexión dedicada) o un único worker; evitar solapamiento y configurar statement/lock timeout.
- **Coordinación:** correr a las 06:05 no garantiza que el worker de las 06:00 haya terminado; tampoco hay dependencia SQL evidente de las MVs respecto a alert_keys. Definir qué coordinación se necesita y disparar por finalización si es requisito.
- **Errores de refresh:** cada vista tiene try/catch independiente y las demás continúan, lo cual es correcto. Falta una métrica/alarma de fallo y frescura; solo logs y esperar al día siguiente dificultan operación. El cron ignora el resultado booleano de refreshAll.
- **Paridad SQL/motores:** probar anulaciones, fechas, garantías vencidas, porcentajes y multidepartamentos antes de consumir las MVs. SQL redondea ejecución a dos decimales, el motor a uno; el SQL convierte avance null a cero y sus agregados deben tener semántica acordada. Un companyId `GLOBAL` colisionaría con el scope reservado; usar scopes con prefijos.
- **Write amplification:** `now() AS actualizado_en` cambia todas las filas en cada refresh concurrente aunque el dominio no cambie. Medir el costo y considerar guardar frescura aparte.
- **Acoplamiento:** CacheService por token es una frontera pequeña adecuada. ReportsService ya combina numerosos repositorios, cálculo, autorización, auditoría y exportación; la caché suma responsabilidad. Mantener la integración acotada y separar estrategias de reporte solo cuando haya una necesidad concreta. Geo conserva dependencias sin uso (`void loader/cupos/settings`); retirarlas cuando se toque ese módulo.
- **Infra/documentación:** `08-alarms.ps1` crea la alarma ALB sin dimensión del load balancer; verificar las dimensiones reales de Valkey y suscripción SNS. Los SG agregan reglas egress sin revocar la regla predeterminada abierta. El script original no corre migraciones y usa credenciales master para la API: distinguir rol de migración y rol runtime. Las afirmaciones de S3/presigned, rate limit, fallback y latencia sub-10ms necesitan evidencia o quedar marcadas como pendientes. El apartado WIRING PENDIENTE de BASE_DATOS también está desactualizado respecto al registro de DashboardsModule.
- **Pruebas reproducibles:** incluir helpers usados por specs en el mismo snapshot y agregar casos de infraestructura caída, cardinalidad, invalidación tardía y registro del scheduler. Los tests existentes de Valkey simulan Redis y no verifican disponibilidad real ni locks concurrentes entre procesos.

## OK confirmado

- JwtAuthGuard está registrado globalmente y valida JWT antes de cargar un usuario activo; PermissionsGuard también es global. Los nuevos endpoints públicos son health/live y health/ready. No se observó una nueva ruta de negocio marcada pública por accidente. `/me` requiere autenticación aunque no permiso adicional; Swagger es público por su montaje separado.
- Geo exige VER; reportes exige EXPORTAR. `r_aud` comprueba AUDITAR **antes** de consultar caché, así que un hit no evita la autorización. Configuración/catálogos y usuarios llevan restricción administrativa.
- **No se confirma fuga de caché entre usuarios:** `construir(key)` no recibe userId/rol y sus consultas actuales son globales; geo solo depende de filtros, incluyendo companyId dentro de la key. Settings también es global. La ausencia de userId no es por sí sola un bug actual; depende de si negocio requiere aislamiento que hoy tampoco existe en las consultas.
- TTLs de settings/geo/reportes son 600/900/120 s con jitter ±10%; single-flight local limpia promises con finally. Valkey utiliza namespace físico y SCAN, no KEYS. Las escrituras/seed de settings tienen llamadas explícitas de invalidación, con las limitaciones de C06.
- El logger elimina recursivamente propiedades sensibles en objetos/arrays y no registra bodies ni headers. El middleware devuelve el correlation-id en la respuesta. TypeORM no publica parámetros en el logger nuevo y configura umbral de slow query de 500 ms; la sanitización de strings tiene los límites descritos.
- Queries revisados de filtros usan parámetros (`:companyId`, `:estado`, `:q`, etc.); la consulta del loader usa `ANY($1)` con parámetros. Refresh utiliza SQL fijo y no concatena entradas del usuario. No se encontró inyección SQL nueva en estos seis commits.
- CORS usa lista explícita de orígenes y credentials, sin reflejar automáticamente cualquier origen. Se requiere revisar la lista productiva, pero no se introdujo un wildcard permisivo.
- Health/live no depende de DB; health/ready ejecuta SELECT 1 y PING y convierte fallos a 503 sin enviar error técnico ni credenciales. El filtro global puede envolver el cuerpo agregado, pero no revela la excepción original en ese caso.
- Las tres MVs se crean WITH DATA y tienen índices UNIQUE ordinarios, sin expresión ni predicado: DANE (`migración:273`), contract_id (`:391`) y scope (`:526`). Cumplen los requisitos estructurales para REFRESH CONCURRENTLY según [PostgreSQL 16](https://www.postgresql.org/docs/16/sql-refreshmaterializedview.html); queda pendiente probar ejecución/ownership en el entorno real.
- synchronize permanece false, existen migraciones up/down y no se altera el frontend. Se habilitan shutdown hooks y el cliente Valkey declara cierre en onModuleDestroy.

## Decisiones dudables para validar con negocio

1. **Visibilidad global frente a empresa/usuario:** ¿EXPORTAR o VER permite ver todas las empresas y contratos, incluso los no asignados? La implementación actual es global. Si el alcance debe ser por usuario/empresa, introducir filtrado autorizado en el servidor y derivar la key del alcance efectivo, no solo de un companyId elegido por el cliente. No basta agregar userId a una key si el query sigue leyendo todo.
2. **Frescura:** acordar demora admisible tras crear/anular/aprobar y mostrar fecha real del snapshot. Un snapshot diario, geo de 15 minutos y exportes calculados al vuelo pueden dar cifras distintas. `generado` en JSON es fecha de respuesta, no instante de cálculo cacheado.
3. **Reportes JSON con permiso EXPORTAR:** confirmar que la consulta en pantalla debe exigir ese permiso; r_aud además exige AUDITAR. Validar que coincide con la matriz funcional.
4. **Definición de KPIs:** validar si incluir pólizas pendientes/vencidas en totales, suma bruta+IVA frente a neto pagado, avance promedio simple frente a ponderado y riesgo crítico por producto. Para geografía, un contrato multidepartamental contribuye su valor a varios departamentos: una suma departamental no equivale al total nacional deduplicado.
5. **Disponibilidad/costo:** ratificar RDS single-AZ, Valkey sin réplica y NAT de una sola AZ con un RTO/RPO explícito. El contrato best effort de caché debe ser coherente con readiness y la elección de tráfico ante una caída.
6. **Demo frente a producción real:** establecer el hito de autenticación, HTTPS, migraciones, permisos runtime y entrega documental antes de llamar productivo al despliegue. WAF en COUNT puede ser una decisión de observación aceptable si se reconoce que no bloquea ataques y el rate limit sí está implementado.
