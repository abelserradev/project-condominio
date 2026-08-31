# Data model — Cobranza read model

PRD: [`../prd/reporte-cobranza.md`](../prd/reporte-cobranza.md) §8–§9.

---

## `cobranza_snapshot`

Colección MongoDB. Un documento activo por edificio.

| Campo | Tipo | Índice | Descripción |
|-------|------|--------|-------------|
| `buildingId` | ObjectId | unique | Tenant |
| `actualizadoEn` | Date | — | Último rebuild OK |
| `resumen` | subdoc | — | Totales agregados |
| `filas` | array | — | Una fila por apartamento |
| `version` | number | — | Debug / optimistic locking |

Implementación: `src/administracion/schemas/cobranza-snapshot.schema.ts`.

---

## `cobranza_report_jobs`

Jobs de Excel async. Ver API spec § colección jobs.

| Campo | Tipo | Índice | Descripción |
|-------|------|--------|-------------|
| `_id` | ObjectId | PK | Expuesto como `jobId` |
| `buildingId` | ObjectId | index | Tenant |
| `estado` | enum | — | `pending` \| `ready` \| `failed` |
| `filtro` | string | — | Filtro aplicado al Excel |
| `fileId` | ObjectId? | — | Referencia archivo GridFS |
| `error` | string? | — | Motivo si failed |
| `listoEn` | Date? | TTL 24h (partial) | Cleanup automático |

Índice TTL: `{ listoEn: 1 }` con `partialFilterExpression: { estado: { $in: ['ready', 'failed'] } }`.

Implementación: `src/administracion/schemas/cobranza-report-job.schema.ts`.

---

## Redis keys

| Clave | TTL | Uso |
|-------|-----|-----|
| `reporte:cobranza:{buildingId}` | 5 min | Caché DTO JSON |
| `snapshot:lock:{buildingId}` | 120 s | Lock rebuild (SET NX) |

Prefijo aplicado por `CacheService`: `condominio:`.
