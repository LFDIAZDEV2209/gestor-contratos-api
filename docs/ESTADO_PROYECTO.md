# Estado del proyecto — nexo-gestor-contratos (para futuros agentes)

> Última actualización: 2026-10-05 · Sesión: backend + frontend SSR en AWS (despliegue completo)

> Continuidad: ver [CONTINUIDAD_OPENCODE.md](CONTINUIDAD_OPENCODE.md) para la evidencia del último despliegue de OpenCode y los pendientes de HTTPS. El listado siguiente contiene planificación histórica; no sustituye una comprobación actual de AWS. Frontend Next SSR: ejecución en ECS/EC2, S3 reservado para documentos/assets.

## Qué existe y dónde

| Pieza | Estado | Ubicación |
|---|---|---|
| Frontend (Next.js, datos mock) | **Desplegado SSR en ECS** (mock intacto; conexión con backend pendiente) | `..\gestor-contratos-front` + `infra/aws/Dockerfile.frontend` (repo API) |
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

1. **HTTPS + dominio (bloqueado en GoDaddy)**: publicar en el panel de GoDaddy (DNS autoritativo) los registros indicados en `docs/CONTINUIDAD_OPENCODE.md`; al confirmar ACM `ISSUED` ejecutar `infra/aws/15-https-listener.ps1` (listener 443 + reglas por hostname + redirect 80→301).
2. **Conexión frontend↔backend**: cambiar los mocks del front por fetch a la API según matriz de `docs/ANALISIS_FRONTEND.md` §2 y GAPs §7. El backend ya bloquea `POST /api/auth/login` en producción con `AUTH_SSO_PENDING` (C01) hasta conectar SSO/OIDC.
3. **Suscribir email** al SNS `nexogc-alarms` (también disparó alarmas `nexogc-billing-60usd` y `nexogc-valkey-high-cpu` en INSUFFICIENT_DATA por falta de suscriptor).
4. **Storage S3 real** para documentos (reemplazar disco local: `documents.service` usa UPLOAD_DIR; abstracción pendiente, ver ADR pendiente).
5. **SSO OIDC** (fase 1 del plan del cliente) — prerrequisito para exponer login en producción.
6. **Rotación de secrets** + Multi-AZ RDS cuando cargue producción real.
7. **Terraform formal** (opcional; los scripts PS1 ya son idempotentes y documentados).

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
