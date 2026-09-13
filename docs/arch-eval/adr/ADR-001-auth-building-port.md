# ADR-001: Puerto BuildingLookup para romper ciclo Auth ↔ Buildings

> **Status**: proposed · **Date**: 2026-09-13 · **Weakness**: WEAK-01

## Context

El grafo muestra un SCC `auth ↔ buildings ↔ owners ↔ common/guards` [METRIC: dep_graph]. Nest usa `forwardRef` entre `AuthModule` y `BuildingsModule` [VERIFY: `auth.module.ts:6`, `buildings.module.ts:6`]. Equipo 1–2 personas; no hay capacidad operativa para microservicios de identidad.

## Decision

Introducir **puerto hexagonal** `BuildingLookupPort` (métodos mínimos que Auth necesita: resolver edificio por slug/id para login). `BuildingsService` implementa el puerto; `AuthModule` importa solo el provider token, no el módulo buildings completo. Guards JWT permanecen exportados desde auth.

**Seam:** archivos que se mueven — ninguno físicamente al inicio; nuevo `buildings/ports/building-lookup.port.ts` + registro en `BuildingsModule.providers`.

## Alternatives

### A: Puerto (propuesta)
- Pros: rompe ciclo, testeable con mock
- Cons: una indirección más
- Cost: ~2–3 días

### B: Servicio “Identity” tercero
- Pros: modelo mental claro
- Cons: módulo extra sin segundo equipo
- Cost: ~1 semana

### C: Do nothing
- Cost: cada feature tenant toca 4 módulos en SCC; 6 co-changes auth/main ya visibles [METRIC: arch_signals]
- Razonable solo si no hay más features multi-tenant en 6 meses

## Consequences

- **Positive:** `cycles_scc` −1 cluster; auth unit tests sin levantar buildings module
- **Negative:** indirection en DI Nest
- **Reversibility:** alta — revert providers

## Verification

`python3 dep_graph.py . -o analysis/` → 0 edges auth↔buildings mutuos.
