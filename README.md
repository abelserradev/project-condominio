# Condominio Platform — Backend

API [NestJS](https://nestjs.com/) multi-tenant para gestión de condominios: recibos, pagos con comprobantes, avisos, propietarios, reglamentos, onboarding de edificios y panel SuperAdmin. Cada edificio queda aislado por `buildingId` en MongoDB.

**Repositorio:** [abelserradev/project-condominio](https://github.com/abelserradev/project-condominio)  
**Frontend asociado:** [abelserradev/condominio-front](https://github.com/abelserradev/condominio-front)

## Características principales

- **Multi-tenant:** slug de edificio, subdominios y registro self-service
- **Pagos:** reporte con archivo, aceptar/rechazar, vínculo con recibos y abonos
- **Recibos y cobranza:** administración, jobs BullMQ/Redis para procesos pesados (Excel)
- **OCR opcional:** extracción de datos de comprobantes (Tesseract + Ollama para logos bancarios)
- **Comunicación:** avisos por edificio; correo vía Resend cuando está configurado
- **Seguridad:** JWT, CSRF, Helmet, throttling, validación DTOs, sanitización y validación de archivos

## Stack

| Capa | Tecnología |
|------|------------|
| Framework | NestJS 11 |
| Lenguaje | TypeScript |
| Base de datos | MongoDB 7 (Mongoose) |
| Colas / caché | Redis, BullMQ |
| Auth | Passport JWT + cookies CSRF (`csurf`) |
| Archivos | Multer, Sharp |
| Tests | Jest (+ e2e en `test/`) |
| Gestor de paquetes | pnpm 11.3 (Node 22 en CI) |

## Requisitos

- Node.js **22** (recomendado; mínimo 18)
- MongoDB 5+
- Redis (requerido para colas de cobranza en entornos completos)
- pnpm

## Instalación

### Opción A — Solo infra en Docker (API en local)

Útil para desarrollo diario: Mongo y Redis sin auth compleja.

```bash
git clone https://github.com/abelserradev/project-condominio.git
cd project-condominio
docker compose -f docker-compose.dev.yml up -d
# Crea .env según la tabla de variables (abajo)
pnpm install
pnpm run start:dev
```

Mongo expuesto en `localhost:27017`; Redis en `localhost:6380` → usa `REDIS_URL=redis://localhost:6380` en `.env`.

### Opción B — Stack completo con Docker

Levanta API, Mongo (puerto host **27018**), Redis interno y Ollama (puerto host **11435**):

```bash
cd project-condominio
# Configura .env con credenciales MONGO_INITDB_* y JWT_SECRET
docker compose up --build
```

La API escucha en **3001**.

### Opción C — Sin Docker

MongoDB y Redis en tu máquina; luego:

```bash
pnpm install
pnpm run start:dev
```

## Variables de entorno

Archivo `.env` en la raíz del repositorio (nunca commitear):

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `MONGODB_URI` | Conexión MongoDB | `mongodb://localhost:27017/condominio` |
| `PORT` | Puerto HTTP de la API | `3001` |
| `JWT_SECRET` | Firma de tokens (obligatorio en producción) | cadena larga aleatoria |
| `FRONTEND_URL` | Origen principal para CORS | `http://localhost:3000` |
| `PLATFORM_ROOT_DOMAIN` | Dominio raíz SaaS (emails y URLs de portal) | `buildforge.work` |
| `REDIS_URL` | Redis para caché y BullMQ | `redis://localhost:6380` |
| `SUPERADMIN_USUARIO` / `SUPERADMIN_PASSWORD` | Credenciales para script o bootstrap | solo local/staging |
| `SUPERADMIN_AUTO_BOOTSTRAP` | Crear SuperAdmin al arrancar si no existe | `true` (opcional, con cuidado) |

**Opcionales**

| Variable | Uso |
|----------|-----|
| `DISABLE_CSRF` | `true` solo en desarrollo |
| `DISABLE_BULLMQ_WORKERS` | `true` si no quieres workers locales |
| `OLLAMA_URL` | OCR/logo bancario (compose: `http://ollama:11434`) |
| `OLLAMA_OCR_TIMEOUT_MS` | Timeout OCR |
| `RESEND_API_KEY` / `MAIL_FROM` | Envío de correos |
| `COBRANZA_SYNC_XLSX` | Sincronización Excel de cobranza |
| `NODE_ENV` | `development` / `production` |

Con `docker compose` estándar, define al menos `MONGO_INITDB_ROOT_USERNAME`, `MONGO_INITDB_ROOT_PASSWORD` y construye `MONGODB_URI` acorde al servicio `mongodb`.

## Scripts de operación

| Comando | Descripción |
|---------|-------------|
| `pnpm run start:dev` | API con watch |
| `pnpm run build` / `start:prod` | Producción |
| `pnpm run test` | Unit tests |
| `pnpm run test:e2e` | E2E (`test/jest-e2e.json`) |
| `pnpm run test:cov:gate` | Cobertura con umbrales en servicios críticos |
| `pnpm run arch:check` | dependency-cruiser + baseline (CI) |
| `pnpm create-superadmin` | Crea usuario SuperAdmin (`SUPERADMIN_*` en `.env`) |
| `SLUG_EDIFICIO=mi-edificio npx ts-node -r tsconfig-paths/register scripts/migrate-add-building-id.ts` | Migración legacy single-tenant |
| `pnpm run migrate:user-tenant-index` | Índice tenant en usuarios (post-build) |

Scripts adicionales en `scripts/`: export OCR, URI Mongo para host, entrenamiento Moondream (Python).

## Estructura del proyecto

```
project-condominio/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── auth/                 # Login unificado, JWT
│   ├── user/ | owners/ | owners-login/
│   ├── buildings/ | building-lookup/ | onboarding/
│   ├── payments/ | administracion/ | banks/
│   ├── apartments/ | avisos/ | reglamentos/ | tasa-bcv/
│   ├── files/ | ocr/ | super/ | bootstrap/
│   └── common/               # CSRF, filtros, mail, caché, utilidades
├── scripts/
├── specs/                    # PRD/API/tareas (p. ej. reporte cobranza)
├── docs/                     # Auditoría y evaluación de arquitectura
├── test/                     # E2E
├── docker-compose*.yml
└── SECURITY.md               # Detalle de controles de seguridad
```

## Endpoints (referencia rápida)

### Públicos / portal

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/tasa-bcv` | Tasa BCV del día |
| GET | `/banks` | Bancos |
| GET | `/buildings/check-slug/:slug` | Disponibilidad de slug |
| POST | `/buildings/register` | Registro de edificio |
| GET | `/administracion/public/pendientes` | Recibos con saldo (portal) |
| POST | `/auth/login` | Login admin / propietario |
| GET | `/csrf/token` | Token CSRF (cookie + header) |

### Protegidos

Rutas bajo JWT con aislamiento por `buildingId` (header/cookie de tenant desde el frontend). Detalle de contratos en `specs/api/` y cambios en `changes/`.

## Seguridad

- **CSRF** en login y creación de pagos (desactivable solo con `DISABLE_CSRF`)
- **CORS** acotado a `FRONTEND_URL` y reglas de desarrollo
- **Throttling** global; login más estricto en producción
- **Archivos:** validación MIME/tamaño antes de persistir
- **Tenant:** queries acotadas por edificio; SuperAdmin en módulo `super`

Más detalle: [SECURITY.md](./SECURITY.md).

## Calidad y CI

`.github/workflows/ci.yml` en push/PR a `main`, `develop` y `desarrollo/**`:

1. Lint + typecheck  
2. `pnpm run arch:check`  
3. Build, tests unitarios, cobertura con gate y e2e según job  

Local:

```bash
pnpm run lint:check && pnpm run typecheck && pnpm run arch:check && pnpm run test
```

## Compose adicionales

| Archivo | Uso |
|---------|-----|
| `docker-compose.dev.yml` | Solo Mongo + Redis para dev local |
| `docker-compose.prod.yml` | Plantilla producción |
| `docker-compose.gpu.yml` / `*.gpu.example.yml` | OCR con GPU |

## Documentación relacionada

- [SECURITY.md](./SECURITY.md)
- [specs/](./specs/) — diseño de funcionalidades (cobranza, etc.)
- [docs/arch-eval/](./docs/arch-eval/) — ADRs y guardrails de arquitectura
- Frontend: [condominio-front](https://github.com/abelserradev/condominio-front) y su `DOCUMENTACION.md`

## Licencia

Proyecto privado (`UNLICENSED`). Uso exclusivo para gestión de condominios.
