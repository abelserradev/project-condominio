# API Spec — Reporte de Cobranza v1.1 (async Excel + read model)

Implementa: PRD [`../prd/reporte-cobranza.md`](../prd/reporte-cobranza.md) (REQ-001 a REQ-017).

---

## Endpoints

### `GET /administracion/reporte/cobranza?format=json|xlsx&filtro=todos|al_dia|moroso`

**Routing NestJS:** declarar **antes** de `GET /administracion/:id`.

#### Headers

| Header | Requerido | Nota |
|--------|-----------|------|
| `Authorization: Bearer <jwt>` | Sí | Token admin |
| `x-building-slug` | Sí (modo plataforma) | `BuildingContextGuard` |

#### Guards

`JwtAuthGuard` → `BuildingContextGuard` → `SubscriptionGuard`.

#### Query params

| Param | Valores | Default |
|-------|---------|---------|
| `format` | `json`, `xlsx` | `json` recomendado |
| `filtro` | `todos`, `al_dia`, `moroso` | `todos` |

---

### Response `format=json` (REQ-008, REQ-014)

```json
{
  "generadoEn": "2026-08-31T18:00:00.000Z",
  "actualizadoEn": "2026-08-31T18:00:00.000Z",
  "fuente": "snapshot",
  "resumen": {
    "totalApartamentos": 240,
    "alDia": 210,
    "morosos": 28,
    "enRevision": 5
  },
  "filas": [ { "...": "..." } ]
}
```

| Campo `fuente` | Significado |
|----------------|-------------|
| `snapshot` | Leído de `cobranza_snapshot` |
| `cache` | Leído de Redis |
| `rebuild` | Cold start; recalculado y persistido en la request |

Notas: `resumen.enRevision` puede solaparse con `morosos`. `alDia + morosos === totalApartamentos`.

---

### `GET ?format=xlsx` — DEPRECATED (REQ-001)

Responde **`410 Gone`** con:

```json
{ "message": "Use POST /administracion/reporte/cobranza/jobs" }
```

Excepción dev: si `COBRANZA_SYNC_XLSX=true`, mantiene respuesta síncrona v1.

---

### `POST /administracion/reporte/cobranza/jobs` (REQ-012)

Encola generación Excel.

**Body opcional:** `{ "filtro": "todos" | "al_dia" | "moroso" }`

**Response `202`:**

```json
{
  "jobId": "507f1f77bcf86cd799439011",
  "estado": "pending",
  "creadoEn": "2026-08-31T18:00:00.000Z"
}
```

---

### `GET /administracion/reporte/cobranza/jobs/:jobId` (REQ-013)

Estados: `pending`, `ready` (con `downloadUrl`), `failed` (con `error`).
Validar `jobId` pertenece al `buildingId` del JWT.

---

### `GET /administracion/reporte/cobranza/jobs/:jobId/download`

Solo si `estado === ready`. Headers Excel iguales a v1.

---

## Colección `cobranza_report_jobs`

| Campo | Tipo | Notas |
|-------|------|-------|
| `_id` | ObjectId | = `jobId` |
| `buildingId` | ObjectId | tenant |
| `estado` | enum | `pending`, `ready`, `failed` |
| `filtro` | string | `todos`, `al_dia`, `moroso` |
| `fileId` | ObjectId? | GridFS al completar |
| `error` | string? | si failed |
| `listoEn` | Date? | TTL 24 h para `ready`/`failed` |

Worker BullMQ cola `cobranza-excel`; concurrencia vía `COBRANZA_EXCEL_WORKER_CONCURRENCY`.

---

## Workbook Excel (sin cambio semántico v1)

**Hoja `Resumen`:** fecha, totales.

**Hoja `Detalle`:** piso, apartamento, categoría, saldos, meses, tipos deuda,
flags revisión, propietario, email.

| Header xlsx | Valor |
|-------------|-------|
| `Content-Type` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |
| `Content-Disposition` | `attachment; filename="reporte-cobranza-{fecha}.xlsx"` |

---

## Errores

| Código | Cuándo |
|--------|--------|
| 400 | `format` o `filtro` inválido |
| 401 | Sin JWT |
| 403 | Suscripción bloqueada |
| 410 | `GET ?format=xlsx` deprecated |

---

## Tests asociados

- `cobranza-classification.util.spec.ts` — REQ-002…005
- `cobranza-snapshot.service.spec.ts` — snapshot, cache, lock
- `cobranza-excel-job.service.spec.ts` — lifecycle job Excel
