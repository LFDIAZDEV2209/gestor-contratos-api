# Continuidad de OpenCode — 2026-10-05 (sesión 2, despliegue AWS completo salvo DNS)

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

## Bloqueo: DNS y certificado (pendiente del usuario en GoDaddy)

- El DNS autoritativo de `sevensave.com.co` sigue siendo GoDaddy (`ns71/ns72.domaincontrol.com`). La zona Route 53 `Z0174632VIDL0S5ZYCM3` sigue existiendo pero **no está delegada** (sus registros son inertes).
- Certificado ACM `4e938570-dcd3-405d-87dc-3d734e883be4` (apex + `*.sevensave.com.co`) sigue en `PENDING_VALIDATION` porque su CNAME de validación **no es visible públicamente desde GoDaddy** (consultado con Google DNS).
- Listener HTTPS 443 + redirect HTTP→HTTPS están listos como `infra/aws/15-https-listener.ps1`; no se ejecutan hasta que ACM sea `ISSUED`.
- Mientras tanto el ALB sigue sirviendo solo HTTP en el Puerto 80 (reglas por hostname arriba) — traffic funciona sin HTTPS pero el bloque de exposición pública real debe esperar al listener 443.

## Acción exacta que debe ejecutar el usuario en GoDaddy (DNS Management)

Tabla de registros (type, name, value — el valor EXACTO, sin truncar):

| # | Tipo | Nombre | Valor |
|---|------|--------|-------|
| 1 | **TXT** | `_dnsauth` | CNAME apuntando a `_a551bcb26ec29986608ee10747a612a2.wzccmgtwzk.acm-validations.aws` |
| 2 | CNAME | `admin` | `nexogc-alb-prod-651088037.us-east-1.elb.amazonaws.com` |
| 3 | CNAME | `api` | `nexogc-alb-prod-651088037.us-east-1.elb.amazonaws.com` |

> **Importante:** el registro 1 (validación ACM) es el CNAME que entrega el certificado:
> ```
> _c49c845a757accdc036d1bfd7908c571.sevensave.com.co
> ```
> — su pequeño subdominio `_c49c845a757accdc036d1bfd7908c571` debe publicarse **como registro dedicado** (en GoDaddy, "Add record → CNAME", Nombre `_c49c845a757accdc036d1bfd7908c571`, valor `_a551bcb26ec29986608ee10747a612a2.wzccmgtwzk.acm-validations.aws`). No sirve meterlo como TXT: ASCII puro tipo CNAME.
> TTL sugerido: 1 hora (3600 s) o el mínimo disponible para validación rápida.
> Aún no crear CNAME `www` ni apuntar apex: se reservan para la página web futura.

Tras publicar, con conta de minutos la ACM queda ISSUED (automático). Después ejecutar:
```powershell
powershell -NoProfile -File infra\aws\15-https-listener.ps1
```
(crea listener 443 con el cert, agrega reglas api/admin, y cambia el listener 80 a un redirect 301 → HTTPS).

## Pendientes de la próxima sesión

1. Ejecutar `15-https-listener.ps1` cuando ACM sea `ISSUED` (revisar `aws acm describe-certificate` o `infra/aws/14-verify-prod.ps1`).
2. Suscribir email del equipo a `nexogc-alarms` (también activa métricas reales de billing/Valkey).
3. Conexión frontend↔backend (adaptador API de `lib/store.ts`) según GAPs de `docs/ANALISIS_FRONTEND.md`.
4. RDS: `rejectUnauthorized:false` es mito transitorio — aplicar CA bundle RDS y健康教育 offline antes de carga productiva.
5. Validar comportamiento de CORS entre `https://admin.sevensave.com.co` y API real cuando ya estén en HTTPS.
