# Continuidad de OpenCode — 2026-10-05 (sesión 2, despliegue AWS completo con HTTPS)

Fuente de este estado: consultas AWS directas de esta sesión (no evidencia histórica). Cuenta `933629770820`, región `us-east-1`, prefijo `nexogc-`.

## Estado de producción verificado hoy

- **Backend**: `nexogc-api-svc` 2/2 running, taskdef `nexogc-api:3` (`CORS_ORIGIN=https://admin.sevensave.com.co`), rollout `COMPLETED`. Targets 2/2 healthy en 4000. `GET /api/health/live` y `/ready` devuelven 200 vía ALB.
- **Frontend**: `nexogc-front-svc` **nuevo** — 2/2 running, taskdef `nexogc-front:1` (imagen `nexogc/front:latest` en ECR, 268 MB, construida con `infra/aws/Dockerfile.frontend` sobre el contexto del repo del front). Targets 2/2 healthy en 3000. `GET /login` devuelve el HTML SSR real (HTTP 200, 13 KB) vía ALB con Host `admin.sevensave.com.co`.
- **ALB**: `nexogc-alb-prod-651088037.us-east-1.elb.amazonaws.com`. Listener 80 reglas:
  - P10 `host=api.sevensave.com.co` → `nexogc-tg-api` (puerto 4000).
  - P20 `host=admin.sevensave.com.co` → `nexogc-tg-front` (puerto 3000).
  - Default → `nexogc-tg-api` (comportamiento histórico intacto).
- **WAF**: `nexogc-waf-prod` asociado al ALB, rate-based 2000/5min + 3 managed rules en COUNT.
- **RDS** `nexogc-db-prod`: available, cifrado, no público, `rds.force_ssl=1`. La API conecta con TLS (`ssl rejectUnauthorized:false` en la imagen desplegada, TODO rotar CA bundle en `data-source.ts`).
- **Valkey** `nexogc-valkey-prod`: available, TLS+auth activos.
- **ECR**: `nexogc/api` (con imágenes) y `nexogc/front` (primera imagen subida hoy, tag `latest`).
- **CloudWatch**: `/nexogc/api-prod`, `/nexogc/migration`, `/nexogc/front-prod` (30 días). Alarmas 5xx/RDS OK; billing y Valkey `INSUFFICIENT_DATA` (falta suscribir email a SNS `nexogc-alarms`).

## Bloqueo de DNS y certificado: RESUELTO (misma sesión, ~18:20 UTC-5)

- El usuario publicó los tres registros en GoDaddy (CNAME de validación ACM + CNAME `admin` + CNAME `api` → ALB). Verificado con Google DNS que resuelven públicamente.
- ACM pasó de `PENDING_VALIDATION` a **`ISSUED`** en ~4 minutos tras publicar el registro.
- Ejecutado `infra/aws/15-https-listener.ps1` (con la corrección del redirect: JSON explícito, no shorthand; y borrado de las reglas por hostname del listener 80 para un redirect total):
  - Listener **443 HTTPS** con certificado y reglas P10 `api.sevensave.com.co` → tg-api, P20 `admin.sevensave.com.co` → tg-front, default → tg-api.
  - Listener **80 HTTP**: default redirect 301 → HTTPS (sin reglas; todo el tráfico HTTP redirige).
- Verificación end-to-end vía los dominios reales:
  - `https://api.sevensave.com.co/api/health/live` → 200 ok; `ready` → 200 ok.
  - `https://admin.sevensave.com.co/login` → 200, HTML SSR del login Seven Safe.
  - `http://api...` y `http://admin...` → 301 → `https://:443/...`.
  - `POST /api/auth/login` en HTTPS → `AUTH_SSO_PENDING` (C01 activo también por HTTPS).

## Pendientes de la próxima sesión

1. Suscribir email del equipo a `nexogc-alarms` (también activa métricas reales de billing/Valkey; ambos alarmas estuvieron en INSUFFICIENT_DATA).
2. Conexión frontend↔backend (adaptador API de `lib/store.ts`) según GAPs de `docs/ANALISIS_FRONTEND.md` — el frontend ya sirve SSR en producción bajo HTTPS, aún con datos mock.
3. RDS: `rejectUnauthorized:false` es mitigación transitoria — aplicar CA bundle real de RDS (`rds-ca-rsa2048-g1`) en el producción real.
4. Validar CORS con el front real ahora que ambos dominios son HTTPS (`Origin: https://admin.sevensave.com.co`).
5. Limpiar la zona Route 53 no delegada `Z0174632VIDL0S5ZYCM3` si se decide mantener DNS solo en GoDaddy (evita costos sin uso).
