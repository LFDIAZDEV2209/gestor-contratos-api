# Observabilidad

## Logs

La API emite JSON por `stdout`. Cada solicitud completada incluye `requestId`, `userId`, `rol`, `metodo`, `ruta`, `status` y `duracionMs`; las que superan 500 ms se registran en nivel `warn`. Las consultas de TypeORM que superan 500 ms generan `database.query.slow` y nunca incluyen parámetros.

Antes de emitirse, los campos con nombres que contengan `password`, `token`, `authorization`, `secret`, `cookie`, `apiKey`, `credential` o `session` se sustituyen por `[REDACTED]`, incluso en objetos anidados. No se deben interpolar secretos dentro de mensajes de texto ni registrar cuerpos de petición sin una revisión explícita.

## Correlation ID

El middleware reutiliza `x-request-id` cuando llega en la petición o genera un UUID. Siempre lo devuelve en la respuesta y lo adjunta al log HTTP. Los consumidores deben reenviarlo en llamadas descendentes y usarlo para buscar una transacción completa en CloudWatch Logs Insights.

## Health checks para ALB/ECS

Use `GET /api/health/live` para el liveness check: confirma que el proceso responde sin depender de infraestructura externa. Use `GET /api/health/ready` para readiness: ejecuta `SELECT 1` con el `DataSource` inyectado; un fallo responde HTTP 503 sin revelar detalles. Si se incorpora un módulo de cache, su readiness debe hacer `PING` y también devolver solo estado agregado.

Para ECS, configure el health check del contenedor/target group contra `/api/health/ready` y deje suficiente `startPeriod` para la conexión de TypeORM. ALB debe considerar éxito solo 2xx.

## Métricas y alarmas CloudWatch recomendadas

- ALB: `HTTPCode_Target_5XX_Count` y tasa 5xx; alarme ante más de 1% durante 5 minutos.
- Latencia: publique percentiles de duración HTTP y alarme p95 por encima del SLO (por ejemplo, 500 ms durante 5 minutos).
- RDS: `CPUUtilization` por encima de 80% durante 10 minutos, y `DatabaseConnections` cerca del límite configurado (por ejemplo, 80%).
- Cache: `Evictions` mayor que cero de forma sostenida y, si está disponible, presión de memoria/conexiones.
- Operación: conteo de eventos `database.query.slow`, errores de readiness y solicitudes sin `requestId`.
