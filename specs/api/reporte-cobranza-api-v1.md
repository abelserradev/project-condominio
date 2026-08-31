# API Spec — Reporte de Cobranza v1

Implementa: PRD [`../prd/reporte-cobranza.md`](../prd/reporte-cobranza.md) (REQ-001 a REQ-009).

---

## Endpoint

```
GET /administracion/reporte/cobranza?format=json|xlsx&filtro=todos|al_dia|moroso
```

**Importante (routing NestJS):** declarar esta ruta estática **antes** de
`GET /administracion/:id` en `administracion.controller.ts`, o `:id` capturará
`"reporte"`.

### Headers

| Header | Requerido | Nota |
|--------|-----------|------|
| `Authorization: Bearer <jwt>` | Sí | Mismo token admin de `GET /administracion` |
| `x-building-slug` | Sí (modo plataforma) | Resuelto por `BuildingContextGuard` |

### Guards

`JwtAuthGuard` → `BuildingContextGuard` → `SubscriptionGuard` (REQ-007).
Sin token: 401. Suscripción vencida/suspendida: 403 con `motivoBloqueo`.

### Query params

| Param | Valores | Default | Validación |
|-------|---------|---------|------------|
| `format` | `json`, `xlsx` | `xlsx` | 400 si otro valor |
| `filtro` | `todos`, `al_dia`, `moroso` | `todos` | 400 si otro valor |

---

## Response `format=json` (REQ-008)

```json
{
  "generadoEn": "2026-08-31T18:00:00.000Z",
  "resumen": {
    "totalApartamentos": 240,
    "alDia": 210,
    "morosos": 28,
    "enRevision": 5
  },
  "filas": [
    {
      "piso": 1,
      "apartamento": 3,
      "idUnico": "P1-A3",
      "categoria": "moroso",
      "saldoBrutoUsd": 150.0,
      "abonoUsd": 20.0,
      "saldoNetoUsd": 130.0,
      "mesesPendientes": [7, 8],
      "tiposDeuda": ["condominio"],
      "tienePagoEnRevision": true,
      "cantidadPagosEnRevision": 1,
      "montoEnRevisionUsd": 75.0,
      "propietario": "María Pérez",
      "emailPropietario": "maria@example.com"
    }
  ]
}
```

Notas de contrato:

- `resumen.enRevision` cuenta apartamentos distintos con pago pendiente y **puede
  solaparse** con `morosos` (un moroso con pago reportado cuenta en ambos).
- `alDia + morosos === totalApartamentos` siempre (categorías excluyentes).
- Montos: `number` con 2 decimales. No se introduce Decimal en esta feature
  (deuda técnica del dominio, documentada en PRD §6).
- `propietario` / `emailPropietario` pueden ser `null` si el apartamento no tiene
  owner activo registrado.
- `mesesPendientes` y `tiposDeuda` derivan solo de recibos con saldo
  (`montoPagado < montoUsd`).

## Response `format=xlsx` (REQ-001)

| Header | Valor |
|--------|-------|
| `Content-Type` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |
| `Content-Disposition` | `attachment; filename="reporte-cobranza-{fechaISO}.xlsx"` |

Workbook con dos hojas:

**Hoja `Resumen`**: fecha de generación, total de apartamentos, al día, morosos,
con pago en revisión.

**Hoja `Detalle`** (una fila por apartamento, ordenada por piso y apartamento):

| Columna | Tipo |
|---------|------|
| Piso | número |
| Apartamento | número |
| Categoría | `al_dia` / `moroso` |
| Saldo bruto USD | número, 2 decimales |
| Abono USD | número, 2 decimales |
| Saldo neto USD | número, 2 decimales |
| Meses pendientes | texto (`"7, 8"`) |
| Tipos de deuda | texto, valores únicos |
| Pago en revisión | `SI` / `NO` |
| Cantidad pagos en revisión | número |
| Monto en revisión USD | número, 2 decimales |
| Propietario | texto o vacío |
| Email propietario | texto o vacío |

## Errores

| Código | Cuándo |
|--------|--------|
| 400 | `format` o `filtro` inválido |
| 401 | Sin JWT o JWT inválido |
| 403 | Suscripción vencida/suspendida |

## Tests asociados

- `cobranza-classification.util.spec.ts`: REQ-002, REQ-003, REQ-004, REQ-005 (unit puros).
- Smoke manual del endpoint: 200 + headers Excel; 401 sin token.
