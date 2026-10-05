# Estrategia y Suite de Pruebas · Nexo Gestor de Contratos API

Este documento describe la arquitectura de pruebas, la cobertura de cada capa del backend y los comandos para ejecutar cada suite de manera profesional y reproducible.

---

## 1. Arquitectura de Pruebas

El sistema de pruebas está organizado en 6 capas complementarias, garantizando cobertura desde funciones puras de cálculo hasta validación de esquemas y llamadas HTTP:

```
┌────────────────────────────────────────────────────────┐
│                   Capa 6: E2E (HTTP)                   │
│   Supertest contra http://localhost:4000/api (Skip)    │
├────────────────────────────────────────────────────────┤
│             Capa 5: Validación de DTOs                 │
│      class-validator / class-transformer (Esquemas)    │
├────────────────────────────────────────────────────────┤
│          Capa 4: Guards & Filtros Comunes              │
│       RBAC (PermissionsGuard), Auth (JwtAuthGuard),    │
│       AllExceptionsFilter, Pagination, Audit-Diff      │
├────────────────────────────────────────────────────────┤
│            Capa 3: Servicios de Dominio                │
│    NestJS Services con Repositorios Mockeados (DI)     │
│   Contracts, Child-Collections, Alerts, Insurance...   │
├────────────────────────────────────────────────────────┤
│             Capa 2: Cache & Infraestructura            │
│         MemoryCacheService, ValkeyCacheService         │
├────────────────────────────────────────────────────────┤
│            Capa 1: Motores de Negocio Puros            │
│    M(c), Semáforo, Alertas, Validador, Conciliación    │
└────────────────────────────────────────────────────────┘
```

---

## 2. Cobertura por Capa

### Capa 1: Motores de Negocio Puros (`src/engines/*.spec.ts`)
Funciones puras y determinísticas sin dependencias de base de datos ni framework:
- **`metrics.engine.spec.ts`**: Métricas financieras $M(c)$ (valor inicial, valor actualizado con adiciones/reducciones, ejecutado, pagado, saldo, porcentajes, fechas y proyección de agotamiento).
- **`traffic-light.engine.spec.ts`**: Semáforo integral evaluando 18 factores de riesgo, priorización del peor nivel y generación de razones explicativas.
- **`alerts.engine.spec.ts`**: 16 tipos de alerta, claves estables (`contrato|...`, `gar|...`, `cupo|...`) y detección de umbrales cruzados.
- **`validator.engine.spec.ts`**: 13 áreas de validación de contrato con severidades Alta (400, bloqueante) y Media/Baja (422, advertencia aceptable).
- **`reconcile.engine.spec.ts`**: Conciliación entre datos contractuales en BD vs. metadatos extraídos de documentos firmados.
- **`cupo.engine.spec.ts`**: Estadísticas de líneas de cupo (`utilizado`, `disponible`, `% de uso`).
- **`map.engine.spec.ts`**: Agregación geográfica departamental y regional sin duplicar contratos multi-cobertura.
- **`modification.engine.spec.ts`**: Reglas de modificaciones contractuales y cálculo de efectos sobre valores, fechas y estados.

### Capa 2: Servicios de Dominio (`src/modules/**/*.service.spec.ts`)
Pruebas unitarias de servicios NestJS con inyección de dependencias (DI mocks) para repositorios TypeORM, servicios de auditoría y configuración:
- **`contracts.service.spec.ts`**:
  - Creación con validación de borrador, control de número duplicado (409) y versión inicial 1.
  - Concurrencia optimista: 409 cuando la versión del DTO está desactualizada o `affected === 0`.
  - Anulación (`anular` / void): marcado de `anulado: true`, `estado: 'Anulado'`, registro de `motivoAnulacion` y auditoría inmutable (sin `DELETE`).
  - Obtención con cálculo en servidor de $M(c)$, semáforo y control score.
  - Conciliación y generación de línea de tiempo cronológica (`timeline`).
- **`child-collections.service.spec.ts`**:
  - Regla de subcontratos: la suma acumulada no debe superar el valor del contrato principal; exclusión de subcontratos anulados.
  - Regla de pagos: cálculo automático de `neto = bruto + iva - retenciones` en servidor; fechas por defecto (`fechaAprob`, `fechaPago`); verificación de permiso `APROBAR`.
  - Regla de ejecución mensual (`execs`): validación de avance físico $\le 100\%$; advertencia (422 con confirmación `force`) si el acumulado supera el valor actualizado.
  - Modificaciones: inmutabilidad (rechazo de edición `actualizar`), creación en transacción con aplicación de efectos sobre el contrato padre.
  - Concurrencia optimista (409) y anulación con motivo.
- **`alerts.service.spec.ts`**:
  - Cruce de umbral en worker de recálculo diario (`recalcular`): registro en tabla `claves` únicamente de aquellas alertas recién cruzadas; reporte de `nuevas`.
  - Claves estables para idempotencia y enlace con gestiones persistidas.
  - Gestión: marcar leída, resolver (requiere permiso `EDITAR`), delegar a usuario.
  - Tareas: creación de tarea vinculada a la alerta y contrato, control de versiones.
- **`insurance.service.spec.ts`**:
  - Cálculo de `cupoStats` por aseguradora; liberación de cupo cuando el contrato principal es anulado.
  - Pólizas por cupo: validación de misma aseguradora, cupo en estado Vigente, saldo disponible suficiente (advertencia 422 si excede), y compatibilidad de fechas de vigencia.
  - Aprobación de pólizas (permiso `APROBAR`), anulación con motivo.
  - Edición de cupos: restricción de cambio de aseguradora si existen pólizas; advertencia si el nuevo valor queda por debajo de lo utilizado.
  - Resumen métrico consolidado por aseguradora (`resumenAseguradoras`).
- **`companies.service.spec.ts`**:
  - `obtenerConIndicadores`: cálculo en servidor de contratos vivos, activos, valor contratado, ejecutado, saldo y vencidos.
  - Creación con validación de NIT duplicado (409).
  - Actualización con control de concurrencia y validación de empresas inactivas.
  - Anulación / inactivación con motivo.
- **`settings.service.spec.ts`**:
  - Parámetros de alerta con fallback a valores por defecto y envoltura en caché.
  - Actualización de parámetros con bitácora e invalidación de caché.
  - Gestión y siembra de 11 catálogos del sistema (`sembrarCatalogos`).

### Capa 3: Seguridad y Guards (`src/modules/**/guards.spec.ts`)
- **`permissions.guard.spec.ts`**: Control de acceso basado en roles (RBAC):
  - Rutas libres pasan directamente.
  - Decorador `@SoloAdmin`: acceso exclusivo para el rol `ADMINISTRADOR` (403 `FORBIDDEN` para otros roles).
  - Decorador `@Perm`: consulta a `RolesService.tienePermiso(rol, permiso)`; acceso automático para administradores.
- **`jwt-auth.guard.spec.ts`**:
  - Rutas marcadas con `@Public` pasan sin autenticación.
  - Validación de cabecera `Authorization: Bearer <token>`.
  - Verificación criptográfica con `JwtService`.
  - Validación de usuario activo y enlace en `request.reqUser`.

### Capa 4: Filtros Globales y Utilidades Comunes (`src/common/**/*.spec.ts`)
- **`all-exceptions.filter.spec.ts`**:
  - Formateo estándar `{ error: { code, message, fields?, warnings? } }`.
  - Manejo de `ApiError` y `WarningRequiresConfirmation` (HTTP 422).
  - Manejo de `OptimisticLockVersionMismatchError` (HTTP 409 `CONFLICT`).
  - Mapeo de errores PostgreSQL (`23505` duplicado a 409, `23503` clave foránea a 400).
  - Manejo de `HttpException` con mensajes compuestos y errores 500 no controlados.
- **`pagination.spec.ts`**:
  - Función `paginar` y lectura segura `leerPagina` con restricciones de tamaño (mínimo 1, máximo 500).
  - Particionado en memoria `partirEnMemoria`.
  - Utilidades de fechas (`diffDias`, `sumarDias`, `periodoAFecha`), IDs con prefijo (`newId`) y diffs de auditoría (`entradasPorCampos`).

### Capa 5: Validación de DTOs (`src/modules/contracts/*.dto.spec.ts`)
- **`contracts.dto.spec.ts`**: Validación estricta con `class-validator` para `CrearContratoDto`, `ActualizarContratoDto` y `ValidarContratoDto`.
- **`children.dto.spec.ts`**: Validación de las 10 colecciones hijas (`subcontracts`, `obligations`, `deliverables`, `execs`, `payments`, `actas`, `modifications`, `risks`, `breaches`, `plans`, documentos y tareas).

### Capa 6: Pruebas E2E Condicionales (`test/e2e/api.e2e-spec.ts`)
Pruebas de extremo a extremo que apuntan a la API HTTP en ejecución (`http://localhost:4000/api`):
- **Auto-skip inteligente**: Si la variable de entorno `E2E_URL` no está definida o si el servidor no responde dentro de **1 segundo**, la suite se salta automáticamente sin romper el build en entornos sin base de datos o sin servidor activo.
- **Flujos validados**:
  - `POST /auth/login` con usuario de prueba sembrado.
  - `GET /contracts` con token Bearer.
  - `GET /companies` con token Bearer.

---

## 3. Guía de Ejecución

### Ejecutar todas las pruebas unitarias y de servicios
```powershell
npx jest --runInBand
# o
pnpm test
```

### Ejecutar una suite específica
```powershell
# Servicio de contratos
npx jest src/modules/contracts/contracts.service.spec.ts

# Colecciones hijas
npx jest src/modules/contracts/child-collections.service.spec.ts

# Alertas
npx jest src/modules/alerts/alerts.service.spec.ts

# Seguros y cupos
npx jest src/modules/insurance/insurance.service.spec.ts

# Guards de seguridad
npx jest src/modules/roles/permissions.guard.spec.ts
npx jest src/modules/auth/jwt-auth.guard.spec.ts

# Validación de DTOs
npx jest src/modules/contracts/contracts.dto.spec.ts
npx jest src/modules/contracts/children.dto.spec.ts
```

### Ejecutar en modo watch (desarrollo)
```powershell
pnpm test:watch
```

### Ejecutar suite E2E
```powershell
# Con servidor apagado (se skipea automáticamente en verde):
pnpm test:e2e

# Con servidor encendido en http://localhost:4000/api:
$env:E2E_URL="http://localhost:4000/api"
pnpm test:e2e
$env:E2E_URL=""
```

---

## 4. Convenciones de Mocks para Nuevas Pruebas

Para mantener la velocidad y evitar bloqueos de archivos en Windows:
1. Utilizar los helpers ubicados en `test/mocks.ts`:
   - `createMockRepo<T>()`: Genera mocks completos de `Repository<T>` de TypeORM (métodos `find`, `findOne`, `save`, `update`, `createQueryBuilder`, etc.).
   - `mockReqContext()`: Contexto de request estándar (`usuario`, `rol`, `ip`).
   - `mockAuditService()`, `mockSettingsService()`, `mockRolesService()`, `mockDataSource()`.
2. Las clases de servicio de NestJS se instancian directamente en `beforeEach` inyectando los mocks en el constructor, garantizando pruebas unitarias rápidas y desacopladas.
