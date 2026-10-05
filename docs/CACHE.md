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

Las escrituras de parámetros invalidan `settings:*`; las actualizaciones y el seed de catálogos invalidan `settings:catalogos:*`. Los servicios de contratos, colecciones hijas, garantías, cupos y empresas invalidan `geo:*` y `reports:*` después de persistir la mutación. Las modificaciones invalidan después del commit de su transacción.

`wrap()` implementa get-or-set con single-flight por clave y generación. Valkey usa un lock `NX PX 10000` con token único y liberación compare-and-delete atómica. La espera por el lock está acotada a 5 segundos; después se ejecuta el factory. Un fallo de infraestructura emite un warning y mantiene single-flight local; los errores del factory se propagan.

Cada familia tiene un contador persistente `nexogc:<ambiente>:_generation:<familia>`, incrementado con `INCR` al invalidar. Las entradas incluyen `:g:<generación>` y un script Lua comprueba la generación antes de publicarlas, en la misma operación atómica. Un factory anterior no publica ni se comparte con solicitudes posteriores a la invalidación. No borre los contadores mientras existan entradas o factories asociados. `delByPattern()` usa `SCAN`, nunca `KEYS`, para limpiar entradas; incrementar una familia invalida también sus otros subpatrones. Las invalidaciones fallidas se reintentan en la siguiente lectura local de esa familia; la coherencia entre procesos requiere Valkey disponible.

Memory limita el almacenamiento a 500 entradas con LRU, barre expirados en cada inserción y mantiene generaciones en proceso. Las claves geo incluyen solamente campos reconocidos, con orden y valores predeterminados estables; los parámetros arbitrarios no generan nuevas entradas.

## Warm-up y operación

No hay warm-up obligatorio: las primeras lecturas llenan las entradas de forma segura. Si se necesita precalentar después de un despliegue, ejecute lecturas autenticadas de catálogos, agregados y los reportes prioritarios. Es seguro borrar entradas: las siguientes lecturas las reconstruyen.

Variables de configuración:

- `VALKEY_HOST`, `VALKEY_PORT` (por defecto `6379`), `VALKEY_PASSWORD`
- `VALKEY_TLS=true` para TLS
- `CACHE_DRIVER=memory` para forzar fallback local
- `CACHE_DEFAULT_TTL` en segundos (por defecto `300`)

Para ElastiCache de producción, use un endpoint de replicación/cluster accesible desde la VPC de la API, TLS en tránsito (`VALKEY_TLS=true`), AUTH token en `VALKEY_PASSWORD`, security groups con acceso mínimo al puerto 6379 y `NODE_ENV=production`. Mantenga el endpoint y el token en secretos del runtime; no se requieren cambios de código.
