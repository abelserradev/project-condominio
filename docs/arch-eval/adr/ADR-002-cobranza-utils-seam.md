# ADR-002: Utils de cobranza sin dependencia de servicios

> **Status**: proposed · **Date**: 2026-09-13 · **Weakness**: WEAK-02, WEAK-04

## Context

SCC `administracion ↔ administracion/utils` [METRIC]. `cobranza-excel.util.ts` importa desde `cobranza-report.service` [VERIFY: line 5]. Módulo administracion acumula 1806 LOC y fan-out 11 [METRIC].

## Decision

1. Crear `cobranza.types.ts` con DTOs/structs compartidos.
2. Utils solo funciones puras (Excel, clasificación) — ya parcialmente testeados en `cobranza-classification.util.spec.ts`.
3. Servicios orquestan; no al revés.

**Seam:** `utils/cobranza-excel.util.ts`, `cobranza-report.service.ts`, tests spec existentes.

## Alternatives

### A: Utils puros (propuesta) — 1–2 días
### B: Subdominio CQRS cobranza — 2+ semanas; ES no requerido (sin auditoría replay)
### C: Do nothing — ciclo permanece; refactors Excel arrastran servicio

## Consequences

- Elimina SCC #2; prepara extracción futura de `CobranzaModule` sin microservicio
- Reversibility: alta

## Verification

dep_graph: no edge utils → `*.service.ts`
