# CI/CD — AWS CodePipeline (autodespliegue push a `main`)

> 2026-10-06 · Implementado vía AWS CLI (usuario `admin-ti`, cuenta 933629770820, región us-east-1).
> Reemplaza el flujo manual (`09-ecs-deploy.ps1` + `10-migrate-prod.ps1`) y a GitHub Actions (inestable).
> Scripts de infraestructura: `infra/aws/16-cicd-iam.ps1` y `infra/aws/17-cicd-pipelines.ps1` (idempotentes).

## 1. Flujo general

```
git push origin main (API o Front)
   │  webhook GitHub App (CodeStar Connections nexogc-github)
   ▼
CodePipeline (disparo automático, sin polling)
   ├─ nexogc-api-pipeline   : Source → Build → Migrate → Deploy
   └─ nexogc-front-pipeline : Source → Build → Deploy
```

| Etapa (API) | Proyecto CodeBuild | Qué hace |
|---|---|---|
| Source | — | Descarga el repo por la conexión GitHub (commit SHA resuelto) |
| Build | `nexogc-api-build` | `pnpm install --frozen-lockfile` → `pnpm test` (251 tests, 24 suites) → `docker build` → push ECR con tag SHA + `latest` → registra **nueva revisión de taskdef** con la imagen SHA → `build-out.json` |
| Migrate | `nexogc-api-migrate` | Task one-off Fargate (`nexogc-api:<rev>` nueva) con override de comando: `typeorm migration:run -d dist/database/data-source.js` → `wait tasks-stopped` → exige `exitCode == 0` |
| Deploy | `nexogc-api-deploy` | `update-service` a la taskdef nueva → `wait services-stable` → **verifica** que la taskdef activa del servicio sea la pedida (detecta rollback del circuit breaker y falla el pipeline) |

| Etapa (Front) | Proyecto CodeBuild | Qué hace |
|---|---|---|
| Source | — | Igual (repo `gestor-contratos-front`) |
| Build | `nexogc-front-build` | `docker build -f infra/Dockerfile.prod` (multi-stage pnpm, Next SSR) → push ECR SHA+latest → registra taskdef nueva |
| Deploy | `nexogc-front-deploy` | Idéntico al Deploy del API sobre `nexogc-front-svc` |

**Garantías del diseño**

- Imágenes **inmutables por SHA de commit** (el taskdef en producción nunca referencia `:latest`).
- Si la migración falla, el pipeline se detiene **antes** de tocar el servicio (prod intacto).
- Si las nuevas tasks no superan health checks, el **circuit breaker de ECS revierte solo** (enable+rollback activados en ambos servicios) y el Deploy lo detecta y marca el pipeline como fallido.
- Buildspecs **versionados en cada repo** (cambiar el CI requiere un commit — nada oculto en la consola).

## 2. Recursos creados (nombre → detalle)

| Recurso | Valor |
|---|---|
| Bucket artifacts | `nexogc-artifacts-933629770820` (SSE-AES256, Block Public Access, deny `aws:SecureTransport=false`, abort multipart 7d en `partial-artifacts/`) |
| Conexión GitHub | `nexogc-github` — `arn:aws:codestar-connections:us-east-1:933629770820:connection/cef21971-6eba-4cd1-90ea-56fbd834d523` (AVAILABLE; GitHub App con acceso a ambos repos) |
| Rol pipeline | `nexogc-cicd-pipeline-role` (S3 artifacts, lanzar/parar builds, `UseConnection`, PassRole a los 3 roles CodeBuild) |
| Rol build | `nexogc-cicd-build-role` (logs `/nexogc/cicd*`, artifacts, push ECR `nexogc/*`, `RegisterTaskDefinition` familias `nexogc-api:*`/`nexogc-front:*`, `DescribeTaskDefinition *`, PassRole exec/task) |
| Rol migrate | `nexogc-cicd-migrate-role` (logs, artifacts, `RunTask/DescribeTasks/StopTask` sobre familia `nexogc-api`, PassRole exec/task) |
| Rol deploy | `nexogc-cicd-deploy-role` (logs, artifacts, `DescribeServices/UpdateService` scoped a los 2 servicios, PassRole exec/task) |
| Proyectos CodeBuild | `nexogc-api-build`, `nexogc-api-migrate`, `nexogc-api-deploy`, `nexogc-front-build`, `nexogc-front-deploy` (imagen `aws/codebuild/standard:7.0`, `BUILD_GENERAL1_MEDIUM`, privileged, source CODEPIPELINE, timeout 60 min) |
| Pipelines | `nexogc-api-pipeline`, `nexogc-front-pipeline` (V2, executionMode SUPERSEDED — un push nuevo cancela el anterior) |
| EventBridge | `nexogc-pipeline-failed` (CodePipeline FAILED → SNS) y `nexogc-ecs-circuit-breaker` (rollback de despliegue → SNS), ambos a `nexogc-alarms` |
| Log group | `/nexogc/cicd` (retención 30 días) |
| SNS | Policy de `nexogc-alarms` actualizada para permitir `events.amazonaws.com` publicar |

**Circuit breaker** (verificado en ambos servicios): `deploymentCircuitBreaker = { enable: true, rollback: true }` — rolling con reversión automática sin recrear servicios.

## 3. Archivos por repo

```
gestor-contratos-api/
  infra/aws/16-cicd-iam.ps1                  # bucket + roles + policies + policy SNS
  infra/aws/17-cicd-pipelines.ps1            # circuit breaker + conexión + proyectos + pipelines + EventBridge
  infra/aws/buildspecs/api.build.yml         # test + docker + push + register taskdef
  infra/aws/buildspecs/api.migrate.yml       # task one-off de migraciones
  infra/aws/buildspecs/api.deploy.yml        # update-service + wait + verificación anti-rollback
  .dockerignore                              # contexto Docker limpio (excluye .env, docs, infra…)
  docs/CICD_CODEPIPELINE.md                  # este documento

gestor-contratos-front/
  infra/Dockerfile.prod                      # copia fiel de infra/aws/Dockerfile.frontend (la imagen de prod)
  infra/buildspecs/build.yml                 # docker + push + register taskdef
  infra/buildspecs/deploy.yml                # update-service + wait + verificación
```

Los scripts `16`/`17` son re-ejecutables (crean si no existe, actualizan si existe).

## 4. Variables fijadas en los buildspecs (no depender del perfil CLI)

El perfil CLI de esta máquina tiene **region us-east-2**; todo `nexogc-` vive en **us-east-1**. Por eso cada buildspec fija `AWS_DEFAULT_REGION: us-east-1` y los scripts pasan `--region` explícito en todas las llamadas. Además: `COREPACK_ENABLE_DOWNLOAD_PROMPT=0` (pnpm vía corepack sin prompt) y el API usa `pnpm@12` (el `pnpm-workspace.yaml` sin `packages` no es tolerado por pnpm 9).

Las subredes/SG de la task one-off van en `api.migrate.yml`: subnets `nexogc-app-a`/`nexogc-app-b`, SG `nexogc-sg-app`, `assignPublicIp=DISABLED`.

## 5. Runbook operativo

**Ver el estado de un deploy**
```bash
aws codepipeline list-pipeline-executions --region us-east-1 --pipeline-name nexogc-api-pipeline --max-results 5
aws codepipeline get-pipeline-state --region us-east-1 --name nexogc-api-pipeline --output json
```

**Logs de un build**
```bash
aws logs tail /nexogc/cicd --region us-east-1 --since 30m --format short
# (en PowerShell 5.1, exportar primero: $env:PYTHONUTF8="1" para evitar errores de encoding)
```

**Re-lanzar manualmente (sin nuevo commit)**
```bash
aws codepipeline start-pipeline-execution --region us-east-1 --name nexogc-api-pipeline
aws codepipeline start-pipeline-execution --region us-east-1 --name nexogc-front-pipeline
```

**Rollback manual de emergencia** (revertir a la revisión anterior del taskdef)
```bash
aws ecs describe-services --region us-east-1 --cluster nexogc-cluster --services nexogc-api-svc \
  --query "services[0].taskDefinition"          # ver actual
aws ecs list-task-definitions --region us-east-1 --family-prefix nexogc-api --sort REV --max-item-count 5
aws ecs update-service --region us-east-1 --cluster nexogc-cluster --service nexogc-api-svc \
  --task-definition nexogc-api:<revision-anterior>
```
Nota: revertir el código se hace con `git revert` + push (el pipeline vuelve a desplegar). El rollback ECS de arriba es el puente de emergencia.

**Pausar el autodespliegue** (p.ej. en una sesión de hotfix delicada): en la consola CodePipeline → pipeline → transición de la etapa Source → "Disable". También sirve: `aws codepipeline put-job-success/failure` no aplica aquí (no hay stages manuales).

**Cambiar el CI** (añadir pasos, cambiar versión de pnpm): editar el buildspec del repo y hacer push — el pipeline lo toma automáticamente (no se toca AWS).

## 6. Troubleshooting — errores reales de la implementación (2026-10-06)

| Síntoma | Causa | Solución aplicada |
|---|---|---|
| Script PS1 aborta en `aws … 2>$null` | PS 5.1 convierte stderr nativo en error terminador con `EAP=Stop` | `EAP=Continue` + validación `$LASTEXITCODE` (`Guard`) en cada paso |
| `ParamValidation: required --policy` | CLI v2 `s3api put-bucket-policy` usa `--policy` | corregido |
| `Invalid compute type provided` | Los tipos son `BUILD_GENERAL1_*` (faltaba prefijo) | corregido |
| `Unknown parameter … "streamPrefix"` | `logsConfig.cloudWatchLogs` usa `groupName`/`streamName` (el stream se auto-genera) | omitido |
| `contains actions in more than one region` | `region` explícito en la acción Source + default en el resto | sin `region` por acción |
| Bucket "not located in us-east-2" | `create-pipeline` sin `--region` → creaba en us-east-2 | `--region` en todas las llamadas; proyectos huérfanos eliminados |
| `Event pattern is not valid` | PS 5.1 destruye las comillas del pattern inline | patterns vía `file://` |
| `[GitHub] Invalid OutputArtifactFormat 'CODEBUILD_DEFAULT'` | no soportado por conexiones CodeStar | omitido (default CODE_ZIP) |
| `YAML_FILE_ERROR: mapping values …` | `echo "x: $var"` con **dos puntos + espacio** dentro de un item YAML | echoes sin `: `; buildspecs validados con `js-yaml` antes de pushear |
| `pnpm --version → packages field missing` | pnpm 9 exige `packages` en `pnpm-workspace.yaml` | `pnpm@12` |
| `429 Too Many Requests` en `docker build` | rate limit anónimo de Docker Hub desde IPs de CodeBuild | base image desde **ECR Public** (`public.ecr.aws/docker/library/node:22-alpine` taggeada como `node:22-alpine`) + `DOCKER_BUILDKIT=0` |
| `not authorized … ecs:DescribeTaskDefinition` | esa acción **no admite** permisos por-ARN | `Resource: "*"` para Describe, ARNs solo para Register |
| `not authorized … ecs:RegisterTaskDefinition on …:nexogc-api:*` | ECS evalúa el registro contra `<familia>:*` | ambos ARNs (con y sin `:*`) |
| `not authorized … iam:PassRole` en `update-service` | UpdateService pasa los roles de la taskdef | `iam:PassRole` también en el rol deploy |
| `Family should not be null or empty` en update-service | el artifact `BuildOut` (primario) baja en `$CODEBUILD_SRC_DIR` **raíz**, no en `$CODEBUILD_SRC_DIR_BuildOut` | leer `build-out.json` con ruta relativa + `|| exit 1` en cada `$( )` de AWS |
| `'charmap' codec can't encode` al leer logs con AWS CLI | CLI v2 (python) en consola cp1252 de Windows | `$env:PYTHONUTF8="1"` |

## 7. Costos estimados (mensual)

- CodePipeline: ~USD 1 por pipeline activo (2 pipelines ≈ USD 2; el primero puede caer en capa gratuita).
- CodeBuild `BUILD_GENERAL1_MEDIUM` (~USD 0.008/min): builds de ~5-10 min → centavos por deploy.
- S3 artifacts, EventBridge, CloudWatch: despreciable.
- Referencia: alarma de facturación existente `nexogc-billing-60usd` cubre desvíos.

## 8. Pendientes / mejoras futuras

- Suscripción de email en `nexogc-alarms` (los avisos de pipeline-failed/rollback hoy no llegan a nadie).
- ECR scan-on-push ya está activo; opcional: gate sobre hallazgos CRITICAL.
- Cache de Docker (BuildKit inline cache o registry cache) para acortar builds.
- Tests e2e (`pnpm test:e2e`) requieren servicio corriendo — hoy solo unit (`pnpm test`) en el Build.
- CMK propia (KMS) para el bucket de artifacts si compliance lo pide (hoy AES256 gestionado por S3).
