# Infraestructura AWS — nexo-gestor-contratos (nexogc)

> Región: `us-east-1` · Cuenta: `933629770820` · Prefix de recursos: `nexogc-`
> Scripts idempotentes en `infra/aws/*.ps1` (IaC-lite; migración futura a Terraform documentada en ADR-005).

> Estado de continuidad: [CONTINUIDAD_OPENCODE.md](CONTINUIDAD_OPENCODE.md). El dominio utilizado por los scripts posteriores es `sevensave.com.co` (`api.sevensave.com.co`), no la propuesta `nexogc.fyatech.com`. El frontend es Next SSR y requiere ECS/EC2; S3 no ejecuta el frontend. Verificación de solo lectura: `infra/aws/14-verify-prod.ps1`.

## Arquitectura de red (VPC `nexogc-vpc-prod` 10.40.0.0/16, 2 AZs)

```
Internet → CloudFront (opcional, fase 2) → WAF (nexogc-waf-prod) → ALB (nexogc-alb-prod, DMZ)
                                                    │
                                    ┌───────────────┴───────────────┐
                                    ▼                               ▼
                        ECS Fargate (nexogc-app-a/b, privadas)  Nexogc API :4000
                                    │                              │
                                    ▼                              ▼
                     RDS PostgreSQL (nexogc-data-a/b, aisladas)   ElastiCache Valkey (nexogc-data-a/b)
```

### Subredes
| Subred | CIDR | AZ | Propósito |
|---|---|---|---|
| `nexogc-pub-a` | 10.40.0.0/20 | us-east-1a | DMZ: ALB + NAT |
| `nexogc-pub-b` | 10.40.16.0/20 | us-east-1b | DMZ: ALB |
| `nexogc-app-a` | 10.40.32.0/20 | us-east-1a | ECS tasks (privada) |
| `nexogc-app-b` | 10.40.48.0/20 | us-east-1b | ECS tasks (privada) |
| `nexogc-data-a` | 10.40.64.0/22 | us-east-1a | RDS + ElastiCache (aislada) |
| `nexogc-data-b` | 10.40.68.0/22 | us-east-1b | RDS + ElastiCache (aislada) |

- **DMZ**: solo ALB y NAT Gateway (`nexogc-nat-a` con EIP `nexogc-nat-eip`).
- **Data**: sin ruta a Internet (route table `nexogc-rt-data` solo local). RDS y Valkey NO son accesibles desde Internet.
- **App**: salida a Internet vía NAT (solo para pulls ECR, SSM, etc.).
- **VPC endpoint S3** (`nexogc-ep-s3`, Gateway): tráfico S3 de app/data no sale por NAT (gratuito).

### Security groups (mínimo privilegio, encadenados)
| SG | Ingress | Origen |
|---|---|---|
| `nexogc-sg-alb` | 80, 443 | 0.0.0.0/0 |
| `nexogc-sg-app` | 4000 | `nexogc-sg-alb` |
| `nexogc-sg-db` | 5432 | `nexogc-sg-app` |
| `nexogc-sg-cache` | 6379 | `nexogc-sg-app` |

## Componentes

### Compute: ECS Fargate
- Cluster: `nexogc-cluster` (capacity provider FARGATE).
- Service: `nexogc-api-svc` — 2 tasks, 0.5 vCPU / 1 GB, awsvpc, **sin IP pública**, subnets app.
- Taskdef `nexogc-api`: imagen `933629770820.dkr.ecr.us-east-1.amazonaws.com/nexogc/api:latest`.
- Secrets inyectados desde Secrets Manager (DB_USER, DB_PASSWORD, JWT_SECRET, VALKEY_PASSWORD) — **jamás** en imagen ni código.
- Health check del contenedor: `GET /api/health/live`; grace period 90 s en el service.
- Estadoless: listo para auto scaling (target tracking CPU 60%) y rolling deployments.

### Compute: Frontend Next SSR (`nexogc-front-svc`)
- Servicio **separado** en el mismo cluster `nexogc-cluster` — 2 tasks Fargate, 0.5 vCPU / 1 GB, awsvpc, sin IP pública, subredes app (privadas).
- Taskdef `nexogc-front`: imagen `nexogc/front:latest` en ECR (construida con `infra/aws/Dockerfile.frontend` sobre el repo del frontend).
- Target group `nexogc-tg-front` (puerto 3000, health check `/` HTTP 200-399), unido al ALB mediante regla por hostname.
- Logs en `/nexogc/front-prod`. Estadoless; listo para auto scaling como la API.

### Base de datos: RDS PostgreSQL 16 (`nexogc-db-prod`)
- `db.t4g.small` single-AZ (el usuario definió ~10 usuarios concurrentes; el cuello esperado es volumen de datos, no conexiones).
- Storage 50 GB gp3 con autoscaling a 500 GB.
- **Escalado**: subir clase de instancia (`db.t4g.medium/large`) es un change con downtime mínimo; Multi-AZ se activa con `modify-db-instance --multi-az` (recomendado antes de producción real; cuesta ~2× el costo de la instancia).
- Backups: retention 7 días + PITR; ventana 03:00–03:30 UTC; `deletion-protection` activado.
- Cifrado en reposo (KMS default), sin acceso público, TLS requerido (sslMode=require en el secret).
- Parameter group `nexogc-pg16`: slow query log > 500 ms (alineado con el compose local).

### Caché: ElastiCache for Valkey 8 (`nexogc-valkey-prod`)
- `cache.t4g.micro`, 1 nodo (sin HA por costo; snapshots 3 días).
- TLS in transit **requerido** + auth token (Secret `nexogc/prod/valkey`).
- **Escalar**: añadir réplica (`increase-replica-count`) + automatic failover cuando se necesite HA; vertical a `t4g.small/large` con minutos de downtime.
- La app usa la abstracción `src/cache` (CACHE_DRIVER=valkey|memory) — cambio de entorno sin tocar código.

### Almacenamiento: S3 (`nexogc-contratos-docs-933629770820`)
- Privado (Block Public Access completo), versioning, SSE-KMS con bucket key.
- Lifecycle: versiones no actuales → STANDARD_IA a 7 días, expiración a 90 días.
- Acceso por prefix `contratos/*` vía task role (mínimo privilegio). Uploads con presigned URLs (backend genera, cliente sube directo).

### WAF (`nexogc-waf-prod`) — asociado al ALB
| Regla | Tipo | Acción |
|---|---|---|
| `nexogc-rate-limit` | Rate-based 2000 req/5min/IP | **Block** |
| `nexogc-common-ruleset` | AWSManagedRulesCommonRuleSet | **Count** (observación) |
| `nexogc-known-bad-inputs` | AWSManagedRulesKnownBadInputsRuleSet | **Count** (observación) |
| `nexogc-sql-injection` | AWSManagedRulesSQLiRuleSet | **Count** (observación) |

> Estrategia anti-falso-positivo: las managed rules viven en COUNT; tras 2-4 semanas revisando SampledRequests/Métricas, se pasa a Block (`update-web-acl`). La rate-based sí bloquea (es la primera línea anti-abuso).

### Secrets (Secrets Manager) — generados aleatoriamente, mostrados UNA VEZ
| Secret | Contenido | Consumo |
|---|---|---|
| `nexogc/prod/db` | usuario, password, host, port, dbname | taskdef (DB_USER/DB_PASSWORD) + DSN |
| `nexogc/prod/valkey` | auth_token | taskdef (VALKEY_PASSWORD) |
| `nexogc/prod/jwt` | jwt_secret | taskdef (JWT_SECRET) |

> Rotación: pendiente definir (rotation lambda) — ver Pendientes.

### Observabilidad
- Log groups: `/nexogc/api-prod`, `/nexogc/migration` (retención 30 días).
- Structured JSON logs con correlation id (ver `docs/OBSERVABILIDAD.md`).
- Alarmas: `nexogc-api-5xx` (ALB), `nexogc-rds-high-cpu` (85%), `nexogc-valkey-high-cpu` (85%), `nexogc-billing-60usd` (EstimatedCharges > 60 USD).
- SNS topic `nexogc-alarms` — **pendiente suscribir email del equipo**.

### CI/CD (pendiente GitHub Actions)
Pipeline objetivo: `Lint → Tests → Build → Docker build → Push ECR → Migration (uno-at-a-time) → Deploy ECS rolling → Health check`.
El script `09-ecs-deploy.ps1` replica ese flujo manualmente (build, push, register taskdef, update service).

## Decisiones (ADRs resumidos)
1. **ECS Fargate vs Lambda**: API tradicional con conexión DB persistente → Fargate (evita cold starts y connection storms). Lambda solo para jobs futuros (ej. exportes pesados asíncronos).
2. **RDS single-AZ ahora, Multi-AZ al cargar**: el cliente definió pocos usuarios; el backup + PITR cubre DR básica. Multi-AZ es un change, no una migración.
3. **ElastiCache single-node**: caché tolera evictions; HA de caché no es crítico en fase 1 (fallback a memoria ya implementado en la app).
4. **WAF en COUNT primero**: estrategia observación→bloqueo para evitar romper clientes legítimos; rate-based bloquea desde el día 1.
5. **IaC-lite con scripts idempotentes PS1**: reproducibles y revisables; Terraform opcional cuando haya CI/CD y estado remoto (ADR pendiente).

## Pendientes de infraestructura
- [ ] Suscribir email del equipo al SNS `nexogc-alarms`.
- [ ] Ejecutar `infra/aws/15-https-listener.ps1` cuando ACM esté `ISSUED` (requiere publicar registros DNS en GoDaddy: ver `docs/CONTINUIDAD_OPENCODE.md`).
- [ ] CloudFront delante del ALB (opcional; WAF también aplica ahí si se mueve) + OAC para S3 assets del front.
- [ ] ECS auto scaling policies + task revision con registros CloudWatch.
- [ ] Rotación automática de secrets.
- [ ] VPC endpoints de interfaz (ECR, logs, SSM) para eliminar el NAT si el costo lo amerita.
- [ ] Terraform (o CDK) formal cuando el pipeline CI/CD esté en marcha.

## Comandos rápidos (recordatorio)
```powershell
# Infra completa local (Postgres + Valkey)
docker compose -f gestor-contratos-api\docker-compose.yml up -d

# Infra AWS por bloques (idempotentes)
powershell -File infra\aws\01-vpc.ps1            # VPC, IGW, subnets, RTs, NAT, EP S3
powershell -File infra\aws\02-security-groups.ps1
powershell -File infra\aws\03-secrets-s3.ps1     # Secrets random + bucket S3
powershell -File infra\aws\04-rds.ps1            # Subnet+PG group + instancia
powershell -File infra\aws\04b-rds-postcheck.ps1 # wait available + actualiza secret
powershell -File infra\aws\05-valkey.ps1
powershell -File infra\aws\06-iam-ecs.ps1        # Roles, ECR, logs, cluster
powershell -File infra\aws\07-waf-alb.ps1        # WAF (count) + ALB + TG + listener
powershell -File infra\aws\08-alarms.ps1         # SNS + billing + alarmas
powershell -File infra\aws\09-ecs-deploy.ps1     # build + push ECR + taskdef + service
```
> Extra frontend SSR: imagen con `infra/aws/Dockerfile.frontend` (contexto del repo del front), taskdef `nexogc-front`, TG `nexogc-tg-front` (:3000). Listener HTTPS + reglas api/admin + redirect 80→301: `infra/aws/15-https-listener.ps1` (solo con ACM `ISSUED`).
