# ADR-003: dependency-cruiser como guardrail de arquitectura

> **Status**: proposed · **Date**: 2026-09-13 · **Weakness**: WEAK-03 (preventive)

## Context

No hay reglas automatizadas que impidan nuevos ciclos [GAP: quality checklist §1]. Hotspots payments/auth [METRIC: arch_signals] sin tests.

## Decision

Añadir `.dependency-cruiser.cjs` con reglas:
- `no-circular` en `src/**`
- `utils-no-service`: `src/**/utils/**` no depende de `**/*.service.ts`
- Opcional: `domain-no-mongoose` fuera de `*.schema.ts` (amber, no error inicial)

Ejecutar en CI tras `pnpm test`.

## Alternatives

### A: dependency-cruiser (propuesta) — S
### B: Solo convención en PR — coste 0, efectividad baja (historial ya muestra ciclos)
### C: Nx module boundaries — overhead alto para repo actual

## Do nothing

Aceptable 3 meses si no hay contratación; riesgo: nuevo forwardRef en onboarding/super.

## Verification

CI job `pnpm exec depcruise src --config .dependency-cruiser.cjs`
