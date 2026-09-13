# Code and security audit — project-condominio (NestJS)

**Date:** 2026-09-13 · **Stack:** NestJS 11, MongoDB, BullMQ · **Audited commit:** `0d5b63f`  
**Tools executed:** detect_stack.py, tsc, eslint, jest --coverage, jscpd, pnpm audit  
**Not executed:** gitleaks, hadolint, semgrep, trivy (binaries not installed in audit environment)

## Executive summary

El backend tiene buena base de seguridad operativa (Helmet, CSRF, throttling, CI con lint/typecheck/build/e2e en `main`) y duplicación de código baja. El riesgo principal es la **cobertura de pruebas**: ~12,5 % global y módulos críticos (auth, payments, administración) casi sin tests unitarios; además hay **19 avisos SCA** (12 high) en la cadena de dependencias. Varios servicios concentran demasiada lógica (SRP en ámbar). El primer paso del plan es instalar guardrails (pre-commit propuesto) y subir cobertura en payments/auth antes de refactors grandes.

## Scorecard

| # | Dimension | Verdict | Evidence |
|---|-----------|---------|----------|
| 1 | DRY | 🟢 | [TOOL: `jscpd src` → 2,50 % líneas duplicadas, 13 clones; ver `analysis/jscpd-backend-console.txt`] |
| 2 | SOLID | 🟡 | S🟡 D🟢 — [VERIFY: `administracion.service.ts` ~533 LOC; `buildings.service.ts` ~399; `administracion.controller.ts` ~312] |
| 3 | Unit tests | 🔴 | [TOOL: `jest --coverage` → All files 12,55 % lines; `payments.service.ts` 38,75 %] |
| 4 | Integration tests | 🟡 | [VERIFY: `test/app.e2e-spec.ts`; CI e2e solo en `main` — `.github/workflows/ci.yml:57-61`] |
| 5 | SAST | ⚪ | not evaluated (tooling) — Semgrep/eslint-plugin-security no ejecutados en auditoría |
| 6 | SCA | 🟡 | [TOOL: `pnpm audit` → 19 vulns: 12 high, 5 moderate — `analysis/pnpm-audit-backend.txt`] |
| 7 | Secrets | ⚪ | not evaluated (tooling) — gitleaks no instalado; `.gitignore` excluye `.env*` y claves |
| 8 | Containers | 🟡 | [VERIFY: `Dockerfile:24-31` — stage `runner` sin `USER` no-root; hadolint no ejecutado] |

## Strengths

- **Validación global** con `ValidationPipe` whitelist + transform en `src/main.ts:46-57`.
- **Superficie HTTP endurecida**: Helmet, cookie parser para CSRF, filtro global de excepciones (`main.ts:18-42`).
- **CI maduro**: lint, typecheck, build, unit tests en PR; e2e con Mongo en servicio para `main`.
- **DRY saludable** (<3 % duplicación jscpd) en ~8,7k LOC TypeScript.
- **Separación modular NestJS** por dominio (payments, administracion, auth, super, ocr, etc.).

## Findings

### P1 — Cobertura insuficiente en auth y flujo de pagos

- **Dimension:** 3 · **Evidence:** [TOOL: jest-cov → `auth.service.ts` 0 %; `payments.service.ts` 38,75 %; global 12,55 %]
- **Impact:** Regresiones en aceptación/rechazo de pagos o login pueden llegar a producción sin detección automática.
- **Fix:** → REMEDIATION-PLAN R-01, R-02

### P2 — Servicios “god” en administración y edificios

- **Dimension:** 2 · **Evidence:** [VERIFY: `src/administracion/administracion.service.ts` ~531 LOC; `src/buildings/buildings.service.ts` ~399 LOC]
- **Impact:** Cambios en recibos/cobranza o multi-tenant edificios tienen alto costo de revisión y riesgo de efectos colaterales.
- **Fix:** → REMEDIATION-PLAN R-03

### P2 — `forbidNonWhitelisted: false` en ValidationPipe

- **Dimension:** 5 · **Evidence:** [VERIFY: `src/main.ts:45-49` — comentario FormData; mass assignment parcialmente mitigado por whitelist]
- **Impact:** Campos extra en JSON body pueden persistir si los DTOs no están estrictamente definidos.
- **Fix:** → REMEDIATION-PLAN R-04

### P2 — SCA: 12 vulnerabilidades high en lockfile

- **Dimension:** 6 · **Evidence:** [TOOL: `pnpm audit --audit-level=moderate` → 19 total — `analysis/pnpm-audit-backend.txt`]
- **Impact:** CVEs transitivos (p. ej. cadena browserslist/baseline-browser-mapping) en build y runtime.
- **Fix:** → REMEDIATION-PLAN R-05

### P3 — Duplicación DTO edificios

- **Dimension:** 1 · **Evidence:** [TOOL: jscpd → `buildings/dto/register-building.dto.ts` ↔ `super/dto/create-building.dto.ts`]
- **Impact:** Divergencia de validación entre registro super-admin y registro edificio.
- **Fix:** → REMEDIATION-PLAN R-06

### P3 — Imagen Docker sin usuario no privilegiado

- **Dimension:** 8 · **Evidence:** [VERIFY: `Dockerfile:24-31` — CMD como root implícito]
- **Impact:** Escalada en contenedor comprometido.
- **Fix:** → REMEDIATION-PLAN R-07

## Discarded findings

| Report | Reason |
|--------|--------|
| jscpd clone OCR parsers | Lógica de parsing compartida acotada; extraer helper cuando haya tercer consumidor |
| “Falta pre-commit en repo” | Husky + lint-staged ya en PR path; pre-commit propuesto es mejora, no P1 |
