# Reporte de Cobranza por Apartamento

## Product Requirements Document (PRD)

| Field | Value |
|---|---|
| **Author** | Equipo Condominio |
| **Status** | `APPROVED` |
| **Version** | 2.0 |
| **Date** | 2026-08-31 |
| **Last updated** | 2026-08-31 |

---

## 1. Resumen ejecutivo

El administrador del condominio necesita consultar y exportar el estado de cobranza
de todos los pisos/apartamentos del edificio: cuáles están al día y cuáles son morosos.
La regla de clasificación vive en el backend (`CobranzaReportService` +
`cobranza-classification.util.ts`) y se expone como:

- **JSON** (`format=json`) para resumen admin e inicio — servido desde read model
  (`cobranza_snapshot`) con caché Redis.
- **Excel async** (`POST .../jobs` → poll → download) para exportación sin bloquear
  la request HTTP.

## 2. Contexto y problema

### 2.1 Situación inicial (v1)

- El frontend calculaba segmentos en el cliente con lógica duplicada.
- No existía endpoint de reporte ni exportación consistente.

### 2.2 Solución v1

Servicio backend único con DTO compartido, Excel síncrono y refactor del frontend.

### 2.3 Evolución v2 (read model)

Con múltiples edificios y lecturas frecuentes del resumen, recalcular desde 5
colecciones en cada GET era costoso. v2 introduce snapshot persistido, caché Redis,
rebuild event-driven e Excel asíncrono con BullMQ.

## 3. Usuarios objetivo

Administrador del edificio (rol admin, autenticado con JWT). No aplica a
propietarios ni al super-admin de plataforma.

## 4. Reglas de negocio (acordadas con el stakeholder)

| Regla | Definición |
|-------|------------|
| **Al día** | Apartamento sin saldo neto pendiente (`saldoNeto === 0`). Incluye apartamentos sin recibo emitido. |
| **Moroso** | Apartamento con `saldoNeto > 0`, cualquiera sea el `tipoDeuda` (condominio, cuotas especiales u otro). |
| **En revisión** | Apartamento con al menos un pago en `estado === 'pendiente'`. No cambia la categoría: si además tiene deuda, sigue siendo **moroso** y el pago en revisión se expone en columnas aparte. |
| **Saldo neto** | `max(0, Σ(montoUsd - montoPagado) - abonoApartamento)`, coherente con la UX pública de recibos. |

Moroso = cualquier saldo pendiente (sin distinción por `tipoDeuda`).

## 5. Criterios de aceptación (EARS)

| ID | Criterio |
|----|----------|
| REQ-001 | WHEN un admin solicita Excel, THE SYSTEM SHALL usar el flujo async (`POST /administracion/reporte/cobranza/jobs` → poll → download). El contenido del archivo SHALL ser equivalente al reporte v1. `GET ?format=xlsx` queda **deprecated** (`410 Gone`; excepción dev: `COBRANZA_SYNC_XLSX=true`). |
| REQ-002 | WHEN un apartamento tiene saldo neto igual a cero, THE SYSTEM SHALL clasificarlo como `al_dia`. |
| REQ-003 | WHEN un apartamento no tiene recibos emitidos, THE SYSTEM SHALL clasificarlo como `al_dia`. |
| REQ-004 | WHEN un apartamento tiene saldo neto mayor a cero, THE SYSTEM SHALL clasificarlo como `moroso`, sin importar el `tipoDeuda`. |
| REQ-005 | WHEN un apartamento tiene pagos en estado `pendiente`, THE SYSTEM SHALL exponer `tienePagoEnRevision`, `cantidadPagosEnRevision` y `montoEnRevisionUsd` sin alterar la categoría principal. |
| REQ-006 | THE SYSTEM SHALL incluir en cada fila: piso, apartamento, categoría, saldo bruto, abono, saldo neto, meses pendientes, tipos de deuda, flags de revisión, propietario y email. |
| REQ-007 | IF el request no lleva JWT válido o el edificio está bloqueado por suscripción, THEN THE SYSTEM SHALL responder 401/403 (el endpoint nunca es público). Jobs y descargas SHALL estar acotados al `buildingId` del JWT. |
| REQ-008 | WHERE el admin solicita `format=json`, THE SYSTEM SHALL responder el DTO con `resumen`, `filas`, `generadoEn`, `actualizadoEn` y `fuente`. |
| REQ-009 | WHERE el admin pasa `filtro=al_dia|moroso` (JSON o job Excel), THE SYSTEM SHALL limitar las filas a esa categoría (por defecto `todos`). |
| REQ-010 | THE SYSTEM SHALL cubrir cada regla de clasificación con tests unitarios puros (sin MongoDB). |
| REQ-011 | WHEN ocurre creación de recibo, aceptación/rechazo de pago o cambio de abono, THEN THE SYSTEM SHALL encolar rebuild del snapshot sin bloquear la request de escritura. |
| REQ-012 | WHEN un admin solicita descarga Excel, THE SYSTEM SHALL encolar un job BullMQ y responder con `{ jobId, estado: "pending" }`. |
| REQ-013 | WHEN un admin consulta el estado de un job Excel, THE SYSTEM SHALL responder `pending`, `ready` (con URL de descarga) o `failed` (con motivo). Jobs `ready`/`failed` SHALL eliminarse tras 24 h (TTL MongoDB). |
| REQ-014 | WHILE existe snapshot reciente, THE SYSTEM SHALL servir `format=json` desde snapshot o caché Redis sin recalcular desde las colecciones fuente. |
| REQ-015 | IF no existe snapshot para el edificio, THEN THE SYSTEM SHALL reconstruirlo en la primera lectura y persistirlo (cold start). |
| REQ-016 | THE SYSTEM SHALL cumplir latencia p95 ≤ 300 ms para `GET .../reporte/cobranza?format=json` con snapshot caliente. |
| REQ-017 | THE SYSTEM SHALL invalidar caché Redis del reporte JSON al completar rebuild. Rebuilds concurrentes SHALL coordinarse con lock Redis `snapshot:lock:{buildingId}`. |

## 6. Fuera de alcance

- Morosidad por días de atraso (`fechaReportada` como fecha límite).
- Export CSV, cron programado de reportes, microservicio separado.
- Rebuild incremental por apartamento (v2 usa rebuild completo por edificio).
- Montos con Decimal: se mantiene `number` con 2 decimales.

## 7. Métricas de éxito

- El admin descarga el Excel desde `/admin/resumen` con selector de filtro opcional.
- `grep esDeudaCondominio` en frontend retorna cero.
- Los totales del gráfico coinciden con `resumen` del JSON backend.
- Segundo GET json consecutivo puede servir desde `fuente: cache`.

## 8. Data model — `cobranza_snapshot`

Read model: un documento por edificio.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `buildingId` | ObjectId | FK edificio; índice único |
| `actualizadoEn` | Date | Última reconstrucción exitosa |
| `resumen` | objeto | `alDia`, `morosos`, `enRevision`, `totalApartamentos` |
| `filas` | array | Contrato `FilaCobranzaDetalle` |
| `version` | number | Incrementa en cada rebuild |

Detalle: [`../data-model/cobranza-snapshot-schema.md`](../data-model/cobranza-snapshot-schema.md).

## 9. Rebuild interno

El rebuild reutiliza `CobranzaReportService.build()` con:

- Recibos solo con saldo pendiente (`montoPagado < montoUsd`).
- Proyección mínima de campos.
- Queries en paralelo (`Promise.all`).

THE SYSTEM SHALL NOT duplicar reglas de clasificación fuera de
`cobranza-classification.util.ts`.

Lock Redis `snapshot:lock:{buildingId}` (TTL 120 s) evita rebuilds duplicados
entre instancias.

## 10. Variables de entorno (v2)

| Variable | Uso |
|----------|-----|
| `REDIS_URL` | Caché JSON + BullMQ + locks. Requerido en prod multi-instancia. |
| `DISABLE_BULLMQ_WORKERS=true` | Dev sin Redis: no levanta consumer Excel. |
| `COBRANZA_SYNC_XLSX=true` | Dev only: mantiene `GET ?format=xlsx` síncrono (deprecated). |
| `COBRANZA_EXCEL_WORKER_CONCURRENCY` | Jobs Excel concurrentes (default `2`). |

Modo degradado sin Redis: caché en memoria del proceso; locks en memoria;
BullMQ requiere Redis para la cola.
