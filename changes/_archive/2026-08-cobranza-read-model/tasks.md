# Tasks — Read model y performance reporte cobranza

Delta: [`delta-spec.md`](./delta-spec.md) · Base PRD: [`../../specs/prd/reporte-cobranza.md`](../../specs/prd/reporte-cobranza.md)

Implementar en lotes de 3–5. Marcar `[x]` al completar.

---

## Lote 1 — Schema y rebuild (sin async Excel aún)

- [x] T-20 [REQ-011/015] Schema Mongoose `CobranzaSnapshot` + índice único `{ buildingId: 1 }`.
- [x] T-21 [REQ-011/017] `CobranzaSnapshotService.rebuild(buildingId)` — wrap de
  `CobranzaReportService.build()` con queries optimizadas (solo recibos con saldo, proyecciones).
- [x] T-22 [REQ-011] Hook/eventos post-escritura: tras `applyPagoAceptado`, `create` recibo,
  `registrarAbono` / abono — encolar rebuild (NestJS `@OnEvent` o cola interna).
- [x] T-23 [REQ-014/015/016] `GET format=json` lee snapshot → Redis cache → fallback rebuild sync.
- [x] T-24 Tests: snapshot persiste DTO equivalente a build(); cold start crea snapshot.

**Done Lote 1:** resumen admin responde ≤300 ms p95 con snapshot caliente (manual/staging).

---

## Lote 2 — Caché e invalidación

- [ ] T-25 [REQ-017] Clave Redis `reporte:cobranza:{buildingId}`; TTL 5 min; invalidar al
  finalizar rebuild.
- [ ] T-26 [REQ-014] Campo `fuente` en respuesta JSON (`snapshot` | `cache` | `rebuild`).
- [ ] T-27 Documentar env `REDIS_URL` requerido en prod; modo degradado sin Redis.

**Done Lote 2:** segundo GET json consecutivo sirve desde `cache` (verificar header/log `fuente`).

---

## Lote 3 — Excel async

- [ ] T-28 [REQ-012] Schema `CobranzaReportJob` + `POST /administracion/reporte/cobranza/jobs`.
- [ ] T-29 [REQ-013] `GET .../jobs/:id` y `GET .../jobs/:id/download`.
- [ ] T-30 [REQ-012] BullMQ worker: lee snapshot (no rebuild), `buildCobranzaWorkbook`, guarda
  en FilesService/GridFS, marca `ready`.
- [ ] T-31 [REQ-001 mod] Deprecar `GET ?format=xlsx` → `410 Gone` (o flag `COBRANZA_SYNC_XLSX` dev only).
- [ ] T-32 Frontend: `descargarReporteCobranzaExcel()` → POST job + poll + download URL.

**Done Lote 3:** descarga Excel no bloquea >2 s en UI; archivo idéntico a v1 en contenido.

---

## Lote 4 — Fold specs y hardening

- [ ] T-33 Lock Redis `snapshot:lock:{buildingId}` en rebuild (evitar duplicados concurrentes).
- [ ] T-34 TTL job cleanup (24 h) + límite concurrencia worker (configurable).
- [ ] T-35 **Fold delta** en `specs/prd/`, `specs/api/`; archivar carpeta `changes/`.
- [ ] T-36 Actualizar `specs/tasks/reporte-cobranza-tasks.md` con estado implementado v2.

**Done Lote 4:** Analyze gate repasado; PRD/API en `specs/` reflejan async Excel.

---

## Dependencias

```
T-20 → T-21 → T-22 → T-23 → T-25 → T-28 → T-30 → T-32
                  ↘ T-24 (paralelo tras T-21)
```

## Fuera de este delta

- Reporting microservice separado.
- Rebuild incremental por apartamento (optimización futura; v2 usa rebuild completo por edificio).
- Cron nocturno de refresh (opcional post-v2).
