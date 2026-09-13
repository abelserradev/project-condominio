# Remediation plan — project-condominio

## Phase 0 — Guardrails (antes de tocar lógica)

1. Instalar hooks propuestos: `pre-commit install` con `.pre-commit-config.yaml` (plantilla NestJS del audit).
2. Añadir job CI: `pnpm audit --audit-level=high` y umbral mínimo de cobertura en módulos `payments/` y `auth/` (p. ej. 70 % lines).
3. Instalar en dev: gitleaks, hadolint (o usar hooks docker de pre-commit).

**Verification:** `pre-commit run --all-files` pasa; CI bloquea audit high.

## Phase 1 — P1

### R-01 · Tests unitarios auth (login, JWT, guards) — en progreso

- **Fix:** `auth.service.spec.ts` ✅ (login plataforma/edificio, admin, propietario); pendiente `jwt-auth.guard.spec.ts`.
- **Effort:** M · **Risk:** Bajo
- **Verification:** `pnpm test:cov` → `auth.service.ts` ≥ 70 % lines

### R-02 · Tests payments (create, aceptar, rechazar)

- **Fix:** Extender `payments.service.spec.ts` cubriendo ramas en `payments.service.ts:75-220`.
- **Effort:** M · **Risk:** Medio (fixtures Mongo)
- **Verification:** `pnpm test:cov` → `payments.service.ts` ≥ 85 % lines

## Phase 2 — P2

### R-03 · Partir `administracion.service` / `buildings.service`

- **Fix:** Extraer sub-servicios (p. ej. recibos vs cobranza snapshot) manteniendo controllers delgados.
- **Effort:** L · **Risk:** Alto — requiere tests de regresión primero (R-01/R-02)
- **Verification:** Ningún archivo de servicio >250 LOC; tests verdes

### R-04 · Endurecer validación multipart vs JSON

- **Fix:** DTOs dedicados por ruta; `forbidNonWhitelisted: true` en rutas JSON; pipe relajado solo en rutas con Multer documentadas.
- **Effort:** M · **Risk:** Medio en reportar-pago
- **Verification:** e2e + prueba manual FormData

### R-05 · Actualizar dependencias SCA

- **Fix:** `pnpm update` / overrides para paquetes con advisory; re-lock y CI.
- **Effort:** S · **Risk:** Bajo-medio
- **Verification:** `pnpm audit --audit-level=high` → 0 high

## Phase 3 — P3

| ID | Fix | Effort | Verification |
|----|-----|--------|--------------|
| R-06 | DTO base compartido register/create building | S | jscpd sin clone par super/buildings |
| R-07 | `USER node` en Dockerfile runner | S | hadolint sin DL3002 |

## Follow-up (Gentle AI)

| Item | Repo | Acción |
|------|------|--------|
| Issue `status:approved` por fase R-01… | abelserradev/project-condominio | `gh issue create` + rama `feat/...` |
| PR a `main` con `Closes #N` | backend | Usuario ejecuta `git push` + `gh pr create` |
