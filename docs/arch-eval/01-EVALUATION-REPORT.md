# Architecture evaluation — project-condominio (NestJS SaaS)

> Reference commit: `0d5b63f` · Date: 2026-09-13  
> Evidence: `analysis/dep_graph.json`, `analysis/arch_signals.json` (local, gitignored)  
> Scope: `src/` TypeScript; scripts/test excluded from god-module heuristics

## Executive summary

La base es un **monolito modular NestJS** adecuado para el tamaño de equipo (bus factor ~100 % en módulos clave). Hay **dos ciclos de dependencias confirmados** en el grafo — uno entre **auth ↔ buildings ↔ owners ↔ common/guards** (acoplamiento de login multi-tenant) y otro **administracion ↔ administracion/utils** (utilidades de cobranza que importan servicios). Los hotspots de cambio concentran riesgo en **`main.ts`**, **auth** y **payments/administracion** sin tests proporcionales. Recomendación: **evolucionar in situ** con guardrails (dependency-cruiser) y romper ciclos por puertos pequeños, **no** extraer microservicios.

## Attribute scorecard

| Attribute | Verdict | Key evidence |
|---|---|---|
| Coupling and boundaries | 🔴 | [METRIC: 2 SCC cycles] auth↔buildings; administracion↔utils [VERIFY: `buildings.module.ts:6`, `auth.module.ts:6`, `cobranza-excel.util.ts:5`] |
| Cohesion and responsibility | 🟡 | [METRIC: `administracion` 1806 LOC, fan-out 11] [VERIFY: `administracion.service.ts` ~533 LOC] |
| Testability | 🔴 | [METRIC: fan-in 12 `common/guards`] [TOOL: jest cov 12,55 % global; auth 0 %] |
| Resilience and integrations | 🟡 | BullMQ/OCR/tasa BCV presentes; [COMMITS: `tasa-bcv.services.ts` 3 fixes] |
| Data and consistency | 🟡 | MongoDB + transacciones parciales; pagos/recibos en servicios centrales sin cobertura |
| Observability | 🟡 | Logger NestJS; [COMMITS: `main.ts` 3 fixes] — bootstrap sigue siendo hotspot |
| Security | 🟢 | CSRF/auth co-change cluster [METRIC: auth.controller↔csrf.guard conf 0,8] alineado con diseño |
| Evolvability and deployment | 🟢 | CI multi-stage, Docker, módulos por dominio; specs/ en repo |

## Strengths

- **Módulos de dominio claros** (payments, administracion, super, ocr) — fan-in moderado salvo núcleo auth/common.
- **Guards y CSRF centralizados** en `common/guards` — alto fan-in esperado en Nest, no dispersión ad hoc.
- **Cola BullMQ** para trabajo asíncrono (OCR/cobranza) — complemento EDA sin distribuir el monolito.
- **Historial reciente acotado** (64 commits) con specs/tasks ya versionados — base para SDD.
- **Sin ciclos en payments** pese a fan-out alto — candidato estable para endurecer tests primero.

## Weaknesses (ranked)

| ID | Sev | Weakness | Attribute | Modules (fan-in) | Evidence | Proposal |
|---|---|---|---|---|---|---|
| WEAK-01 | P1 | Ciclo auth ↔ buildings (forwardRef) | Coupling | auth (9), buildings (8) | [METRIC] + [VERIFY: modules mutual import] | ADR-001 |
| WEAK-02 | P1 | Ciclo administracion ↔ utils | Coupling | administracion (3) | [METRIC] + [VERIFY: util imports service] | ADR-002 |
| WEAK-03 | P2 | Hotspot payments/admin sin regresión | Testability | payments (1)* | [METRIC: co-change auth cluster; hotspot payments.service] | ADR-003 |
| WEAK-04 | P2 | God-module administracion (LOC + fan-out) | Cohesion | administracion | [METRIC: 1806 LOC module, fan-out 11] | ADR-002 |
| WEAK-05 | P3 | DTO/entity carpetas “orphan” en grafo | — | — | [METRIC: dep_graph orphans] | Mantener; tipos sin edges |

### WEAK-01: Ciclo auth ↔ buildings

- **What happens:** `AuthModule` importa `BuildingsModule` y viceversa vía `forwardRef`, enlazando login con resolución de edificio en el mismo SCC que owners y guards.
- **Evidence:** [METRIC: dep_graph SCC #1] [VERIFY: `src/auth/auth.module.ts:6`, `src/buildings/buildings.module.ts:6`]
- **Why it matters:** Cualquier cambio en tenant/building obliga a recompilar/razonar el ciclo completo; dificulta extraer “identity” más adelante.
- **If nothing:** Más `forwardRef` y tests de integración frágiles.
- **Proposal:** ADR-001 — puerto `TenantContext` / listener en owners, buildings sin importar AuthModule.

### WEAK-02: Utilidades de cobranza acopladas al servicio

- **What happens:** `cobranza-excel.util.ts` importa tipos/lógica desde `cobranza-report.service`, cerrando ciclo con el paquete administracion.
- **Evidence:** [METRIC: SCC #2] [VERIFY: `administracion/utils/cobranza-excel.util.ts:5`]
- **Proposal:** ADR-002 — mover tipos a `cobranza.types.ts`; util solo funciones puras.

## Dismissed findings

| Finding | Reason |
|---|---|
| `common/guards` fan-in 12 | Hub de autorización Nest; válido si guards permanecen delgados |
| `src/payments/dto` orphan | DTOs sin imports TS detectables — no dead code |
| Co-change `DOCUMENTACION.md` ↔ tasa-bcv | Documentación, no acoplamiento runtime |

## Areas not evaluated

- Infra multi-región / cell-based
- Métricas OpenTelemetry (no revisado en código)
