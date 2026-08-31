# Tasks — Reporte de Cobranza (v1 + v2 read model)

PRD [`../prd/reporte-cobranza.md`](../prd/reporte-cobranza.md) ·
API [`../api/reporte-cobranza-api-v1.md`](../api/reporte-cobranza-api-v1.md) ·
Data model [`../data-model/cobranza-snapshot-schema.md`](../data-model/cobranza-snapshot-schema.md)

Convención: `[x]` = implementado y verificado.

---

## v1 — Clasificación, Excel síncrono, frontend (completado)

### Lote 1 — Clasificación pura

- [x] T-01 [REQ-002…005/010] `cobranza-classification.util.ts` + spec.
- [x] T-02 Tests unitarios puros.

### Lote 2 — Servicio de reporte

- [x] T-03 [REQ-001/006/008] `cobranza-report.service.ts`.
- [x] T-04 Schemas en `administracion.module.ts`.

### Lote 3 — Excel + endpoint

- [x] T-05 Dependencia `exceljs`.
- [x] T-06 `cobranza-excel.util.ts`.
- [x] T-07 `GET administracion/reporte/cobranza`.

### Lote 4 — Frontend v1

- [x] T-08 `lib/api.ts` tipos y fetch.
- [x] T-09 `admin/resumen/page.tsx`.
- [x] T-10 `admin/inicio/page.tsx`.

### Lote 5 — Validación v1

- [x] T-11 `pnpm test` backend.
- [x] T-12 Smoke endpoint.
- [x] T-13 Sin `esDeudaCondominio` en frontend.

---

## v2 — Read model, caché, Excel async (completado)

Delta archivado en `changes/_archive/2026-08-cobranza-read-model/`.

### Lote 1 — Schema y rebuild

- [x] T-20 Schema `CobranzaSnapshot`.
- [x] T-21 `CobranzaSnapshotService.rebuild()`.
- [x] T-22 Hook post-escritura (pagos, recibos, abonos).
- [x] T-23 `GET format=json` snapshot → cache → rebuild.
- [x] T-24 Tests snapshot / cold start.

### Lote 2 — Caché e invalidación

- [x] T-25 Redis `reporte:cobranza:{buildingId}`, TTL 5 min.
- [x] T-26 Campo `fuente` en JSON.
- [x] T-27 Env `REDIS_URL`; degradado sin Redis documentado en PRD §10.

### Lote 3 — Excel async

- [x] T-28 Schema `CobranzaReportJob` + `POST .../jobs`.
- [x] T-29 `GET .../jobs/:id` y download.
- [x] T-30 BullMQ worker lee snapshot, GridFS, marca ready.
- [x] T-31 `GET ?format=xlsx` → 410 (`COBRANZA_SYNC_XLSX` dev).
- [x] T-32 Frontend POST + poll + download.

### Lote 4 — Hardening y fold

- [x] T-33 Lock Redis `snapshot:lock:{buildingId}` en rebuild.
- [x] T-34 TTL jobs 24 h + `COBRANZA_EXCEL_WORKER_CONCURRENCY`.
- [x] T-35 Fold delta en `specs/`; archivar `changes/`.
- [x] T-36 Este archivo actualizado a v2.

### Frontend post-v2

- [x] T-37 Selector filtro `todos|al_dia|moroso` en descarga Excel (`/admin/resumen`).

---

## Fuera de alcance (post-v2)

- Reporting microservice separado.
- Rebuild incremental por apartamento.
- Cron nocturno de refresh.
