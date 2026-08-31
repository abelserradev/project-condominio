# Tasks — Reporte de Cobranza

Implementa: PRD [`../prd/reporte-cobranza.md`](../prd/reporte-cobranza.md) +
API [`../api/reporte-cobranza-api-v1.md`](../api/reporte-cobranza-api-v1.md).

Convención: `Done` = verificable (test pasa, endpoint responde, UI renderiza).
Implementar en lotes de 3–5 con revisión entre lotes.

## Lote 1 — Clasificación pura

- [x] T-01 [REQ-002/003/004/005] Crear `src/administracion/utils/cobranza-classification.util.ts`
  con funciones puras: `calcularSaldoBruto`, `calcularSaldoNeto`,
  `clasificarApartamento`, `agregarRecibosPorApartamento`, `agregarPagosPendientes`.
- [x] T-02 [REQ-010] Crear `cobranza-classification.util.spec.ts` cubriendo:
  sin recibos → al_dia; pagado completo → al_dia; saldo cualquier tipoDeuda → moroso;
  abono cubre saldo → al_dia; moroso + pago pendiente → moroso con flag; solo pago
  pendiente → al_dia con flag.

## Lote 2 — Servicio de reporte

- [x] T-03 [REQ-001/006/008] Crear `src/administracion/cobranza-report.service.ts`:
  orquesta apartments, recibos (reutiliza `AdministracionService.findAll`), abonos
  (map directo del modelo), pagos pendientes (modelo `Payment` por `forFeature`,
  sin importar `PaymentsModule` para evitar ciclo) y owners.
- [x] T-04 Registrar `Payment`, `Owner`, `Apartment` schemas en
  `administracion.module.ts` (forFeature) y declarar `CobranzaReportService`.

## Lote 3 — Excel + endpoint

- [x] T-05 Agregar dependencia `exceljs` a `project-condominio/package.json`.
- [x] T-06 [REQ-001/006] Crear `src/administracion/utils/cobranza-excel.util.ts`:
  workbook con hojas Resumen y Detalle.
- [x] T-07 [REQ-001/007/008/009] Endpoint `GET administracion/reporte/cobranza` en
  `administracion.controller.ts`, declarado antes de `:id`, con los 3 guards,
  validación de `format`/`filtro` y stream del buffer XLSX.

## Lote 4 — Frontend

- [x] T-08 [REQ-008] `condominio-front/lib/api.ts`: tipos `FilaCobranza`,
  `ReporteCobranza`; `fetchReporteCobranzaJson()` y `descargarReporteCobranzaExcel()`.
- [x] T-09 [REQ-001/008] `admin/resumen/page.tsx`: consume JSON backend, botón
  Descargar Excel, gráfico 3 categorías (alDia/morosos/enRevision), elimina
  `calcularSegmentos` y helpers de tipoDeuda.
- [x] T-10 [REQ-008] `admin/inicio/page.tsx`: sustituye `calcularMetricas` por
  `reporte.resumen`; elimina funciones duplicadas.

## Lote 5 — Validación

- [x] T-11 `pnpm test` en backend verde (especialmente cobranza-classification).
- [x] T-12 Smoke: endpoint autenticado → 200 xlsx; sin token → 401.
- [x] T-13 Grep confirma cero usos de `esDeudaCondominio` en frontend.
