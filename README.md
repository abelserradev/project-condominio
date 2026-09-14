# Condominio Platform — Backend

API [NestJS](https://nestjs.com/) multi-tenant para gestión de condominios: recibos, pagos con comprobantes, avisos, propietarios, reglamentos, onboarding de edificios y panel SuperAdmin.

**Repositorio:** [abelserradev/project-condominio](https://github.com/abelserradev/project-condominio)  
**Frontend asociado:** [abelserradev/condominio-front](https://github.com/abelserradev/condominio-front)

## Características principales

- **Multi-tenant:** edificios aislados a nivel de datos
- **Pagos y recibos:** reporte, revisión administrativa y cobranza
- **Avisos y reglamentos** por edificio
- **Integraciones opcionales** (correo, OCR, colas) según despliegue
- **Controles de seguridad** en capas (autenticación, validación, límites de uso, archivos)

## Stack

| Capa | Tecnología |
|------|------------|
| Framework | NestJS 11 |
| Lenguaje | TypeScript |
| Base de datos | MongoDB (Mongoose) |
| Colas / caché | Redis, BullMQ (cuando aplica) |
| Tests | Jest (+ e2e en `test/`) |
| Gestor de paquetes | pnpm 11.3 (Node 22 en CI) |

## Requisitos

- Node.js **22** (recomendado; mínimo 18)
- Dependencias de infraestructura según entorno (base de datos, colas, etc.)
- pnpm

## Instalación (desarrollo)

```bash
git clone https://github.com/abelserradev/project-condominio.git
cd project-condominio
pnpm install
pnpm run start:dev
```

Hay archivos `docker-compose*.yml` para levantar servicios de apoyo en local o producción. **La configuración concreta (secretos, URLs, puertos) no se publica en el README**; el equipo la comparte por canal interno.

## Scripts habituales

| Comando | Descripción |
|---------|-------------|
| `pnpm run start:dev` | API con watch |
| `pnpm run build` / `start:prod` | Producción |
| `pnpm run test` | Unit tests |
| `pnpm run test:e2e` | E2E |
| `pnpm run arch:check` | Guardrails de arquitectura (CI) |

Utilidades adicionales viven en `scripts/` (migraciones, operaciones puntuales); su uso requiere contexto del equipo.

## Estructura del proyecto

```
project-condominio/
├── src/              # Módulos NestJS por dominio
├── scripts/          # Utilidades de mantenimiento
├── test/             # E2E
├── specs/            # Especificaciones de producto (acceso restringido al flujo de trabajo del equipo)
├── docs/             # Notas técnicas internas
└── docker-compose*.yml
```

## API

Contratos y rutas no se listan aquí de forma pública. Desarrolladores autorizados consultan `specs/` y el frontend asociado.

## Calidad y CI

`.github/workflows/ci.yml` ejecuta lint, typecheck, guardrails de arquitectura, build y tests en push/PR a `main`, `develop` y `desarrollo/**`.

## Licencia

Proyecto privado (`UNLICENSED`). Uso exclusivo para gestión de condominios.
