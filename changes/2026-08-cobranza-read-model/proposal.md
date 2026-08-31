# Proposal — Read model y performance del reporte de cobranza

> Status: draft  
> Affected base specs: `specs/prd/reporte-cobranza.md`, `specs/api/reporte-cobranza-api-v1.md`  
> Date: 2026-08-31  
> Author: Equipo Condominio

## Problema / motivación

La v1 del reporte (`CobranzaReportService.build`) recalcula en **cada request** el
estado de cobranza del edificio ejecutando **5 consultas MongoDB** (apartamentos,
recibos completos, pagos pendientes, owners, abonos) y agregando en memoria en Node.
Además, `format=xlsx` genera el workbook **en la misma request HTTP** con exceljs.

Esto funciona para un edificio y pocos usuarios, pero escala mal cuando:

- Varios edificios (multi-tenant) piden reporte **en paralelo** → contención en MongoDB y CPU.
- Un edificio tiene **muchos apartamentos** o **historial largo de recibos pagados**
  → `findAll({ buildingId })` trae documentos irrelevantes para la clasificación.
- Varios admins descargan Excel a la vez → picos de memoria y latencia > 10 s.

Evidencia en código: [`cobranza-report.service.ts`](../../src/administracion/cobranza-report.service.ts)
L70–84; endpoint síncrono Excel en [`administracion.controller.ts`](../../src/administracion/administracion.controller.ts)
L229–249. El PRD v1 dejó colas async y migraciones **fuera de alcance** (§6); este
delta las incorpora de forma acotada.

## Alcance

**Incluye:**

1. Colección read model `cobranza_snapshot` (1 documento por edificio).
2. Rebuild del snapshot **asíncrono** tras eventos de escritura relevantes.
3. Lectura del reporte JSON desde snapshot (fallback a rebuild on-demand si no existe).
4. Caché Redis del DTO JSON con invalidación al actualizar snapshot.
5. Generación Excel **asíncrona** vía cola (BullMQ + Redis), con polling de estado.
6. Optimización de queries de rebuild (solo recibos con saldo, proyecciones).

**No incluye:**

- Microservicio de reporting separado (queda como fase futura; el worker vive en el monolito).
- Reporting cross-edificio (un admin sigue viendo **solo su** edificio).
- Morosidad por días vencidos.
- Cambio de reglas de clasificación (REQ-002…005 sin cambios).
- Decimal para montos.

## Impacto

| Área | Impacto |
|------|---------|
| **API JSON** | Compatible: mismo DTO; añade campos opcionales `actualizadoEn`, `fuente` |
| **API Excel** | **Breaking opt-in**: `format=xlsx` síncrono deprecado; nuevo flujo async (REQ-012) |
| **Frontend** | Resumen/inicio: sin cambio de contrato JSON; botón Excel pasa a polling/job |
| **MongoDB** | Nueva colección `cobranza_snapshot`; índice único `{ buildingId: 1 }` |
| **Infra** | Requiere `REDIS_URL` para caché y cola (ya soportado parcialmente por `CacheService`) |
| **Consistencia** | Eventual: snapshot se actualiza segundos después de aceptar pago / emitir recibo |

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Snapshot stale tras fallo de worker | TTL máximo + rebuild on-demand si `actualizadoEn` > N min |
| Doble rebuild concurrente | Lock Redis `snapshot:lock:{buildingId}` |
| Excel job perdido | Estado persistido en Mongo `cobranza_report_jobs`; reintentos BullMQ |
| Sin Redis en dev | Fallback: rebuild síncrono + Excel síncrono (modo degradado documentado) |

## Constitution check

- **Multi-tenant:** snapshot keyed por `buildingId`; rebuild nunca cruza edificios.
- **Seguridad:** jobs y snapshot filtrados por `buildingId` del JWT; mismos guards.
- **DRY:** `CobranzaReportService.build()` sigue siendo la única lógica de clasificación;
  el snapshot es persistencia del resultado, no reglas duplicadas.
- **Specs versionadas:** delta en `changes/`; fold a `specs/` al implementar.
