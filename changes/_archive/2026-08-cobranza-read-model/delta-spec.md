# Delta — Read model y performance del reporte de cobranza

Base: `specs/prd/reporte-cobranza.md` v1.0, `specs/api/reporte-cobranza-api-v1.md` v1.  
Nuevos IDs continúan desde REQ-011.

---

## ADDED

### specs/prd/reporte-cobranza.md → Data model (nueva sección §8)

**Colección `cobranza_snapshot`** (read model, 1 doc por edificio):

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `buildingId` | ObjectId | FK edificio; índice único |
| `actualizadoEn` | ISO datetime | Última reconstrucción exitosa |
| `generadoEn` | ISO datetime | Alias expuesto al cliente (= `actualizadoEn` en lectura) |
| `resumen` | objeto | Igual contrato actual (`alDia`, `morosos`, `enRevision`, `totalApartamentos`) |
| `filas` | array | Igual contrato `FilaCobranzaDetalle` actual |
| `version` | number | Incrementa en cada rebuild (optimistic locking / debug) |

THE SYSTEM SHALL mantener como máximo un snapshot activo por `buildingId`.

---

### specs/prd/reporte-cobranza.md → Requirements

- **REQ-011** (event-driven): WHEN ocurre cualquiera de: creación de recibo, aceptación
  o rechazo de pago, cambio de abono por apartamento, THEN THE SYSTEM SHALL encolar un
  rebuild del snapshot de cobranza para ese `buildingId` sin bloquear la request HTTP
  de escritura.

- **REQ-012** (event-driven): WHEN un admin solicita descarga Excel, THEN THE SYSTEM
  SHALL encolar un job asíncrono y responder `202 Accepted` con `{ jobId, estado: "pending" }`
  en lugar de bloquear hasta generar el archivo.

- **REQ-013** (ubiquitous): WHEN un admin consulta el estado de un job Excel, THE SYSTEM
  SHALL responder `pending`, `ready` (con URL o token de descarga) o `failed` (con motivo).

- **REQ-014** (state-driven): WHILE existe snapshot con `actualizadoEn` menor a 5 minutos,
  THE SYSTEM SHALL servir `format=json` desde snapshot o caché Redis sin recalcular desde
  las 5 colecciones fuente.

- **REQ-015** (unwanted behavior): IF no existe snapshot para el edificio, THEN THE SYSTEM
  SHALL reconstruirlo de forma síncrona en la primera lectura y persistirlo antes de responder
  (cold start).

- **REQ-016** (ubiquitous): THE SYSTEM SHALL cumplir latencia p95 ≤ 300 ms para
  `GET .../reporte/cobranza?format=json` con snapshot caliente (medido sin Excel).

- **REQ-017** (ubiquitous): THE SYSTEM SHALL invalidar caché Redis del reporte JSON al
  completar rebuild del snapshot para ese `buildingId`.

---

### specs/prd/reporte-cobranza.md → Rebuild interno (nueva sección §9)

El rebuild SHALL reutilizar `CobranzaReportService.build()` o extracción equivalente con
estas optimizaciones:

- Consultar recibos solo con saldo pendiente (`montoPagado < montoUsd`), no historial pagado.
- Proyección mínima de campos en todas las queries del rebuild.
- Ejecutar queries en paralelo (`Promise.all`), como hoy.

THE SYSTEM SHALL NOT duplicar reglas de clasificación fuera de
`cobranza-classification.util.ts`.

---

### specs/api/reporte-cobranza-api-v1.md → Endpoints

#### `GET /administracion/reporte/cobranza?format=json` (MODIFICADO — ver abajo)

Respuesta extendida:

```json
{
  "generadoEn": "2026-08-31T18:00:00.000Z",
  "actualizadoEn": "2026-08-31T18:00:00.000Z",
  "fuente": "snapshot",
  "resumen": { "...": "..." },
  "filas": [ "..."]
}
```

| Campo `fuente` | Significado |
|----------------|-------------|
| `snapshot` | Leído de `cobranza_snapshot` |
| `cache` | Leído de Redis (mismo DTO) |
| `rebuild` | Cold start; recalculado y persistido en la request |

#### `POST /administracion/reporte/cobranza/jobs` (NUEVO — REQ-012)

Encola generación Excel.

**Request:** headers auth igual que GET; body opcional `{ filtro?: "todos"|"al_dia"|"moroso" }`.

**Response `202`:**

```json
{
  "jobId": "507f1f77bcf86cd799439011",
  "estado": "pending",
  "creadoEn": "2026-08-31T18:00:00.000Z"
}
```

#### `GET /administracion/reporte/cobranza/jobs/:jobId` (NUEVO — REQ-013)

**Response `200` pending:**

```json
{ "jobId": "...", "estado": "pending", "creadoEn": "..." }
```

**Response `200` ready:**

```json
{
  "jobId": "...",
  "estado": "ready",
  "listoEn": "...",
  "downloadUrl": "/administracion/reporte/cobranza/jobs/:jobId/download"
}
```

**Response `200` failed:**

```json
{ "jobId": "...", "estado": "failed", "error": "..." }
```

#### `GET /administracion/reporte/cobranza/jobs/:jobId/download` (NUEVO)

Solo si `estado === ready`. Mismos headers Excel que v1 (`Content-Type`, `Content-Disposition`).
Validar que `jobId` pertenece al `buildingId` del JWT.

---

### specs/api/reporte-cobranza-api-v1.md → Colección `cobranza_report_jobs`

| Campo | Tipo | Notas |
|-------|------|-------|
| `_id` | ObjectId | = `jobId` expuesto |
| `buildingId` | ObjectId | tenant |
| `estado` | enum | `pending`, `ready`, `failed` |
| `filtro` | string | `todos`, `al_dia`, `moroso` |
| `fileId` | ObjectId? | referencia GridFS/files al completar |
| `error` | string? | si failed |
| `creadoEn`, `listoEn` | Date | auditoría |

TTL sugerido: eliminar jobs `ready`/`failed` > 24 h (índice TTL opcional).

---

## MODIFIED

### specs/prd/reporte-cobranza.md → §6 Fuera de alcance

- **Antes:** "Export CSV, colas async, cron de reportes" y "Cambios de schema MongoDB" fuera de alcance.
- **Después:** Se **retiran** de fuera de alcance: colas async para Excel y schema
  `cobranza_snapshot` / `cobranza_report_jobs`. Permanece fuera de alcance: CSV,
  cron programado, microservicio separado, Decimal.

---

### specs/prd/reporte-cobranza.md → REQ-001

- **Antes:** WHEN admin solicita `format=xlsx`, THE SYSTEM SHALL responder archivo descargable en la misma request.
- **Después:** WHEN admin solicita Excel, THE SYSTEM SHALL usar el flujo async REQ-012/013
  (`POST .../jobs` → poll → download).  
- **Razón:** Evitar bloqueo HTTP y picos de CPU con múltiples edificios concurrentes.
- **Compatibilidad:** `GET ?format=xlsx` queda **deprecated** una release; responde
  `410 Gone` con body `{ "message": "Use POST /administracion/reporte/cobranza/jobs" }`
  o redirige internamente al job (decisión implementación — preferir 410 explícito).

---

### specs/api/reporte-cobranza-api-v1.md → `GET ?format=xlsx`

- **Antes:** Respuesta síncrona con buffer Excel.
- **Después:** Deprecated. Responder `410 Gone` + enlace al nuevo endpoint, **o**
  (modo degradado sin Redis) mantener síncrono solo si `COBRANZA_SYNC_XLSX=true` en env
  (documentado en tech design; no para producción multi-edificio).

---

### specs/api/reporte-cobranza-api-v1.md → Response JSON

- **Antes:** Solo `generadoEn`.
- **Después:** Añade `actualizadoEn`, `fuente` (ver ADDED). Campos `resumen` y `filas`
  sin cambios semánticos (REQ-002…009 intactos).

---

## REMOVED

_Ningún REQ retirado._ REQ-001 se **modifica** en comportamiento de transporte Excel,
no en el contenido del archivo generado.

---

## Analyze gate (pre-implementación)

| Check | Estado |
|-------|--------|
| REQ-002…010 sin cambio semántico | OK |
| REQ-001 modificado → tasks + frontend Excel | Pendiente implementación |
| Nuevo schema → data-model fold | Pendiente |
| `fuente`/`actualizadoEn` no rompen frontend si opcionales | OK (campos extra) |
| Jobs filtrados por buildingId | REQ-007 extendido implícitamente |
| Tests REQ-010 siguen válidos (util pura unchanged) | OK |
| Nuevo: tests integración snapshot rebuild + job lifecycle | Añadir en tasks |

---

## Fold checklist (post-implementación)

Al mergear implementación, actualizar en `specs/`:

1. `specs/prd/reporte-cobranza.md` — §6, §8, §9, REQ-011…017, nota REQ-001.
2. `specs/api/reporte-cobranza-api-v1.md` — v2 o sección "v1.1 async Excel".
3. Crear `specs/data-model/cobranza-snapshot-schema.md` (opcional, recomendado).
4. Archivar `changes/2026-08-cobranza-read-model/` → `changes/_archive/`.
