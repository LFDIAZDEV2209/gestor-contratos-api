# Caché con Valkey

La aplicación expone una caché global mediante `CACHE_SERVICE`. Valkey se usa cuando `VALKEY_HOST` existe y `CACHE_DRIVER` no es `memory`; de lo contrario se usa una caché local en proceso. La caché es *best effort*: una indisponibilidad de Valkey no impide iniciar ni responder la API.

## Claves y TTL

Las claves físicas llevan namespace por ambiente: `nexogc:dev:*` fuera de producción y `nexogc:prod:*` en producción. A cada TTL se le aplica jitter aleatorio de ±10 %.

| Caso | Patrón lógico | TTL |
| --- | --- | --- |
| Parámetros y catálogos | `settings:*` | 10 min |
| Agregados geográficos | `geo:departamentos:*`, `geo:regiones:*` | 15 min |
| Respuestas JSON de reportes | `reports:*` | 2 min |

## Invalidación y concurrencia

Las escrituras de parámetros invalidan `settings:*`; las actualizaciones y el seed de catálogos invalidan `settings:catalogos:*`. Las rutas de escritura de contratos, garantías y cupos deben invalidar `geo:*` y `reports:*` al incorporarse o modificarse, porque son sus fuentes de datos.

`wrap()` implementa get-or-set. Evita el stampede con single-flight dentro del proceso y, en Valkey, un lock `NX PX 10000`; quienes no adquieren el lock esperan brevemente a que se publique el valor antes de calcularlo. `delByPattern()` usa `SCAN`, nunca `KEYS`.

## Warm-up y operación

No hay warm-up obligatorio: las primeras lecturas llenan las entradas de forma segura. Si se necesita precalentar después de un despliegue, ejecute lecturas autenticadas de catálogos, agregados y los reportes prioritarios. Es seguro borrar entradas: las siguientes lecturas las reconstruyen.

Variables de configuración:

- `VALKEY_HOST`, `VALKEY_PORT` (por defecto `6379`), `VALKEY_PASSWORD`
- `VALKEY_TLS=true` para TLS
- `CACHE_DRIVER=memory` para forzar fallback local
- `CACHE_DEFAULT_TTL` en segundos (por defecto `300`)

Para ElastiCache de producción, use un endpoint de replicación/cluster accesible desde la VPC de la API, TLS en tránsito (`VALKEY_TLS=true`), AUTH token en `VALKEY_PASSWORD`, security groups con acceso mínimo al puerto 6379 y `NODE_ENV=production`. Mantenga el endpoint y el token en secretos del runtime; no se requieren cambios de código.
