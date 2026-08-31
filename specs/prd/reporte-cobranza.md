# Reporte de Cobranza por Apartamento

## Product Requirements Document (PRD)

| Field | Value |
|---|---|
| **Author** | Equipo Condominio |
| **Status** | `APPROVED` |
| **Version** | 1.0 |
| **Date** | 2026-08-31 |
| **Last updated** | 2026-08-31 |

---

## 1. Resumen ejecutivo

El administrador del condominio necesita descargar un reporte Excel (`.xlsx`) con el
estado de cobranza de todos los pisos/apartamentos del edificio: cuáles están al día y
cuáles son morosos. Hoy esa clasificación existe solo como gráfico circular en el
resumen admin, calculada en el navegador con lógica duplicada en dos páginas y sin
posibilidad de exportarla. Esta feature centraliza la regla de clasificación en el
backend y la expone en dos formatos: JSON (para el resumen admin, eliminando la
duplicación) y Excel descargable (para gestión de cobranza).

## 2. Contexto y problema

### 2.1 Situación actual

- `condominio-front/app/admin/resumen/page.tsx` calcula segmentos
  (libres/morosos/en progreso) en el cliente trayendo todos los recibos y pagos.
- `condominio-front/app/admin/inicio/page.tsx` duplica esa lógica con
  `calcularMetricas`, `esDeudaCondominio` y `esDeudaCuotasEspeciales`.
- No existe ningún endpoint de reporte ni exportación.

### 2.2 Problema

La regla de negocio vive solo en frontend y está duplicada: cualquier exportación
generada en el navegador divergiría del gráfico al primer cambio de criterio. Además
los pagos reportados pendientes de aceptación se cargan en el resumen pero nunca se
usan en el cálculo.

### 2.3 Oportunidad

Un servicio backend único (`CobranzaReportService`) con un DTO de resultado consumido
por: (a) el endpoint Excel, (b) la página de resumen, (c) las métricas de inicio.
Una sola fuente de verdad, testeable con unit tests puros.

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

**Cambio intencional vs UI actual:** se elimina la distinción por `tipoDeuda`
(condominio/cuotas) como criterio de morosidad y la categoría "en progreso" del
gráfico. Moroso = cualquier saldo pendiente.

## 5. Criterios de aceptación (EARS)

| ID | Criterio |
|----|----------|
| REQ-001 | WHEN un admin autenticado solicita `GET /administracion/reporte/cobranza?format=xlsx`, THE SYSTEM SHALL responder un archivo `.xlsx` descargable con una fila por apartamento del edificio. |
| REQ-002 | WHEN un apartamento tiene saldo neto igual a cero, THE SYSTEM SHALL clasificarlo como `al_dia`. |
| REQ-003 | WHEN un apartamento no tiene recibos emitidos, THE SYSTEM SHALL clasificarlo como `al_dia`. |
| REQ-004 | WHEN un apartamento tiene saldo neto mayor a cero, THE SYSTEM SHALL clasificarlo como `moroso`, sin importar el `tipoDeuda`. |
| REQ-005 | WHEN un apartamento tiene pagos en estado `pendiente`, THE SYSTEM SHALL exponer `tienePagoEnRevision`, `cantidadPagosEnRevision` y `montoEnRevisionUsd` sin alterar la categoría principal. |
| REQ-006 | THE SYSTEM SHALL incluir en cada fila: piso, apartamento, categoría, saldo bruto, abono, saldo neto, meses pendientes, tipos de deuda, flags de revisión, propietario y email. |
| REQ-007 | IF el request no lleva JWT válido o el edificio está bloqueado por suscripción, THEN THE SYSTEM SHALL responder 401/403 (el endpoint nunca es público). |
| REQ-008 | WHERE el admin solicita `format=json`, THE SYSTEM SHALL responder el mismo DTO con `resumen` (totales alDia/morosos/enRevision) y `filas`, consumido por el resumen admin y las métricas de inicio. |
| REQ-009 | WHERE el admin pasa `filtro=al_dia|moroso`, THE SYSTEM SHALL limitar las filas del reporte a esa categoría (por defecto `todos`). |
| REQ-010 | THE SYSTEM SHALL cubrir cada regla de clasificación con tests unitarios puros (sin MongoDB). |

## 6. Fuera de alcance

- Morosidad por días de atraso (`fechaReportada` como fecha límite).
- Export CSV, colas async, cron de reportes.
- Cambios de schema MongoDB o migraciones.
- Montos con Decimal: se mantiene `number` con 2 decimales (deuda técnica existente del dominio).

## 7. Métricas de éxito

- El admin descarga el Excel desde `/admin/resumen` en un clic.
- `grep esDeudaCondominio` en frontend retorna cero tras el refactor.
- Los porcentajes del gráfico de resumen coinciden con los totales del Excel.
