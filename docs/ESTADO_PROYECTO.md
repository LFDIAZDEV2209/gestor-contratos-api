# Estado del proyecto — nexo-gestor-contratos (para futuros agentes)

> Última actualización: 2026-10-05 · Sesión: backend NestJS + infra AWS

## Qué existe y dónde

| Pieza | Estado | Ubicación |
|---|---|---|
| Frontend (Next.js, datos mock) | **INTACTO** (no tocar hasta fase de conexión) | `..\gestor-contratos-front` |
| Backend NestJS 11 + TypeORM | Funcional, 28 tablas + motores + 19 reportes + RBAC | `gestor-contratos-api/src` |
| Análisis funcional del front | Completo (211 KB, matriz por vista + GAPs) | `docs/ANALISIS_FRONTEND.md` |
| Modelo de datos + índices + MVs | Doc + migración aplicada | `docs/BASE_DATOS.md` + `src/database/migrations/1727910000000-...` |
| Caché Valkey | Abstracción + wiring settings/geo/reports | `src/cache/*` + `docs/CACHE.md` |
| Observabilidad | Logs JSON estructurados + correlation id + health live/ready | `src/common/observability/*` + `docs/OBSERVABILIDAD.md` |
| Tests | 231 tests VERDE (unit + guards + DTOs + e2e con auto-skip) | `src/**/*.spec.ts`, `test/` + `docs/TESTING.md` |
| Infra local | PostgreSQL 16 (5433) + Valkey 8 (6380) docker compose | `docker-compose.yml` |
| Infra AWS | VPC 2AZ + SGs + S3 + Secrets + ECR + ECS cluster + WAF + ALB + RDS + Valkey + alarmas | `infra/aws/*.ps1` + `docs/AWS.md` |
| Despliegue ECS | Script 09 (build/push/taskdef/service) | `infra/aws/09-ecs-deploy.ps1` |
| Migraciones prod | Task one-off ECS | `infra/aws/10-migrate-prod.ps1` |

## Credenciales y secrets

- En **Secrets Manager** (`nexogc/prod/db|valkey|jwt`) — nunca en repo. Las passwords random se mostraron al usuario una vez (2026-10-05).
- Local dev: `.env` del repo (no commiteado; ver `.env.example`).

## Pendientes priorizados (siguiente sesión)

1. **Conexión frontend↔backend**: cambiar los mocks del front por fetch a `http://localhost:4000/api` (o ALB DNS) según matriz de `docs/ANALISIS_FRONTEND.md` §2 y GAPs §7.
2. **Migración prod** (`10-migrate-prod.ps1`) tras crear el service; luego health check del ALB.
3. **HTTPS**: ACM + Route53 + listener 443 + redirect 80→443 (requiere dominio del cliente).
4. **Suscribir email** al SNS `nexogc-alarms`.
5. **Storage S3 real** para documentos (reemplazar disco local: `documents.service` usa UPLOAD_DIR; abstracción pendiente, ver ADR pendiente).
6. **SSO OIDC** (fase 1 del plan del cliente).
7. **Rotación de secrets** + Multi-AZ RDS cuando cargue producción real.
8. **Terraform formal** (opcional; los scripts PS1 ya son idempotentes y documentados).

## Reglas del proyecto (resumen operativo)

- Sin borrados físicos: `POST /…/:id/void` con motivo + auditoría.
- Concurrencia por `version` (409 en PUT desactualizado).
- Validaciones SIEMPRE en servidor (el front es solo UX).
- Dinero entero COP; fechas AAAA-MM-DD; snake_case en BD (naming strategy).
- Audit log INSERT-only con trigger + hash encadenado.
- Nunca `synchronize` en TypeORM: solo migraciones.
- Cache keys: `nexogc:<env>:<dominio>:<args>`; invalidar en escrituras.

## Cómo levantar todo local (desde cero)

```powershell
cd gestor-contratos-api
pnpm install
cp .env.example .env        # ajustar passwords
docker compose up -d        # db + valkey
pnpm migration:run          # esquema + índices + MVs
pnpm seed                   # datos demo (fechas relativas a hoy)
pnpm test                   # 231 tests
pnpm start:dev              # http://localhost:4000/api · Swagger /api-docs
```

## Liado del deploy AWS (orden)

`01-vpc → 02-security-groups → 03-secrets-s3 → 04-rds → 04b-rds-postcheck → 05-valkey → 06-iam-ecs → 07-waf-alb → 08-alarms → 09-ecs-deploy → 10-migrate-prod`
(10 después del service; reordenar: 10 puede correr justo tras 04b si se prefiere esquema listo antes del primer deploy).
