# Architecture migration plan — project-condominio

> Strategy: **evolve in place** (modular monolith) — equipo pequeño, un despliegue, BullMQ ya cubre async.

## Phase 1: Guardrails ✅ (implementado 2026-09-13)

- **dependency-cruiser** (`.dependency-cruiser.cjs`): regla `utils-no-service` (error); `no-circular` (warn hasta ADR-001).
- **Baseline** versionado: `docs/arch-eval/arch-baseline.json` + `scripts/check-arch-baseline.mjs` + `scripts/arch/dep_graph.py`.
- **CI:** job `architecture-guardrails` ejecuta `pnpm run arch:check`.
- **Ciclo administracion/utils eliminado:** DTOs en `src/administracion/utils/cobranza.types.ts`.
- **Tests de caracterización:** `src/auth/auth-characterization.spec.ts` (supertest, mock AuthService).

**Done:** CI falla si SCC > 1 o reaparece ciclo `administracion/utils`; depcruise falla si utils importa `*.service.ts`.

**Rollback:** Desactivar job de grafo; reglas eslint opcionales.

## Phase 2: Romper ciclo auth ↔ buildings (ADR-001) ✅ (2026-09-13)

1. **`AuthCoreModule`**: JWT + guards sin `AuthService`.
2. **`BuildingLookupModule`** (`src/building-lookup/`) + puerto `BUILDING_LOOKUP`; schema en `src/entities/building.schema.ts`.
3. **`AuthModule`** importa lookup, no `BuildingsModule`; **`BuildingsModule`** importa `AuthCoreModule`, no `AuthModule`.
4. **`OwnersModule`**: `AuthCoreModule` en lugar de `AuthModule`.
5. CI baseline prohíbe pares mutuos `auth↔buildings` y `administracion↔utils`.

**Done:** [METRIC: `cycles_pairs` sin auth↔buildings; depcruise `auth-no-buildings-imports`]

## Phase 2b: Romper ciclo auth ↔ owners ✅ (2026-09-13)

1. **`OwnersLoginModule`** (`src/owners-login/`) + `OWNERS_LOGIN` port.
2. **`entities/owner.schema.ts`**; auth sin `forwardRef(OwnersModule)`.
3. Test caracterización en **`test/`** (evita arco auth→common en dep_graph).
4. Baseline prohíbe par mutuo **auth↔owners**.

**Done:** `cycles_pairs` sin auth↔owners; depcruise `auth-no-owners-imports`.

## Phase 3: Desacople buildings ↔ common ✅ (2026-09-13)

1. **`CommonModule`** sin `BuildingsModule` ni guards tenant.
2. Guards en **`src/buildings/`** (`building-context.guard`, `subscription.guard`).
3. **`BuildingTenantGuardsModule`**: facade `imports/exports` `BuildingsModule` para el resto de dominios.
4. Baseline **`maxStronglyConnectedComponents: 0`**.

**Rollback:** Revert commits arch en rama `desarrollo/backup`.

## Phase 3 (legacy doc): Cobranza — utils puros (ADR-002) — hecho en Phase 1

1. Extraer tipos compartidos a `administracion/cobranza/cobranza.types.ts`.
2. Refactor `cobranza-excel.util.ts` a funciones puras (sin import de service).
3. Opcional: sub-módulo Nest `CobranzaModule` importado por `AdministracionModule`.

**Done:** SCC administracion/utils eliminado; tests cobranza existentes verdes.

## Phase 4: Cohesión administracion (ADR-002 ext.)

- Partir `administracion.service.ts` solo tras Phase 2–3 y cobertura ≥40 % en administracion/payments.

**Metric target:** ningún servicio >250 LOC; fan-out administracion ≤7.

## Reconciliation with code-audit

- R-01/R-02 tests (code-audit) son **prerrequisito** de Phase 4.
- No tocar OCR/tesseract en Phase 2–3 salvo regresión.
