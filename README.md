# Condominio Platform — Backend

Sistema SaaS multi-tenant para la gestión de condominios y residencias. Permite a múltiples edificios gestionar pagos, recibos, avisos y propietarios de forma aislada y segura.

## Características principales

- **Multi-tenant:** Cada edificio tiene su propio subdominio y datos aislados
- **Roles:** SuperAdmin (plataforma), Admin (edificio), Propietario/Inquilino (residente)
- **Gestión de pagos:** Reporte de pagos con comprobantes, aceptación/rechazo por parte de la administración
- **Recibos:** Creación y seguimiento de facturas de condominio
- **Avisos:** Sistema de notificaciones para residentes
- **Seguridad:** JWT, CSRF, CORS, rate limiting, validación de archivos
- **OCR:** Extracción automática de datos de comprobantes bancarios

## Stack tecnológico

- **Framework:** [NestJS](https://nestjs.com/) 11
- **Lenguaje:** TypeScript
- **Base de datos:** MongoDB (Mongoose)
- **Autenticación:** Passport JWT + CSRF (csurf)
- **Seguridad:** Helmet, Throttler, class-validator
- **Archivos:** Multer + Sharp (compresión de imágenes)
- **Testing:** Jest

## Requisitos

- Node.js 18 o superior
- MongoDB 5.0 o superior (local o Docker)
- pnpm o npm

## Instalación

### Con Docker (recomendado)

```bash
cd backend/condomini
docker compose up --build
```

Esto levanta MongoDB y la API en el puerto **3001**.

### Sin Docker (solo API)

1. Tener MongoDB corriendo (por ejemplo en `localhost:27017`)
2. Crear el archivo `.env` (ver sección de variables)
3. Ejecutar:

```bash
cd backend/condomini
pnpm install
pnpm run start:dev
```

## Variables de entorno

Crear un archivo `.env` en `backend/condomini/`:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `MONGODB_URI` | Cadena de conexión a MongoDB | `mongodb://localhost:27017/condominio` |
| `PORT` | Puerto donde escucha la API | `3001` |
| `FRONTEND_URL` | URL del frontend (para CORS) | `http://localhost:3000` |
| `JWT_SECRET` | Clave secreta para tokens JWT | `una-cadena-larga-y-aleatoria` |
| `SUPERADMIN_USUARIO` | Usuario del SuperAdmin (solo para script) | `admin` |
| `SUPERADMIN_PASSWORD` | Contraseña del SuperAdmin | `password-seguro` |

**Opcional:**

| Variable | Descripción |
|----------|-------------|
| `REDIS_URL` | Conexión a Redis para caché distribuido |
| `DISABLE_CSRF` | Desactiva CSRF (solo desarrollo) |

**Importante:** No subir nunca archivos `.env` al repositorio.

## Scripts útiles

### Crear SuperAdmin

```bash
cd backend/condomini
pnpm create-superadmin
```

Define `SUPERADMIN_USUARIO` y `SUPERADMIN_PASSWORD` en tu `.env` local y ejecuta el comando.

### Migración de datos legacy

Para migrar datos de una instalación single-tenant anterior:

```bash
SLUG_EDIFICIO=mi-edificio npx ts-node scripts/migrate-add-building-id.ts
```

## Estructura del proyecto

```
backend/condomini/
├── src/
│   ├── main.ts                 # Punto de entrada
│   ├── app.module.ts           # Módulo raíz
│   ├── auth/                   # Autenticación (JWT, login unificado)
│   ├── user/                   # Usuarios administradores
│   ├── owners/                 # Propietarios/inquilinos
│   ├── payments/               # Pagos reportados
│   ├── administracion/         # Recibos y abonos
│   ├── buildings/              # Edificios (tenants)
│   ├── apartments/             # Apartamentos
│   ├── avisos/                 # Sistema de avisos
│   ├── banks/                  # Bancos disponibles
│   ├── files/                  # Gestión de archivos
│   ├── tasa-bcv/               # Tasa de cambio BCV
│   ├── ocr/                    # Extracción de comprobantes
│   ├── super/                  # Panel SuperAdmin
│   └── common/                 # Guards, filtros, utilidades
├── scripts/                    # Scripts de utilidad
├── .env                        # Variables de entorno (NO subir)
└── README.md                   # Este archivo
```

## Endpoints principales

### Públicos (sin autenticación)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/tasa-bcv` | Tasa BCV del día |
| GET | `/banks` | Lista de bancos |
| GET | `/buildings/check-slug/:slug` | Verificar disponibilidad de slug |
| POST | `/buildings/register` | Registro self-service de edificio |
| POST | `/auth/login` | Login (admin/propietario) |
| GET | `/csrf/token` | Token CSRF |

### Protegidos (requieren JWT)

Ver documentación completa en `condominio/documentacion.md`.

## Seguridad

- **CSRF:** Protección en login y POST de pagos
- **CORS:** Orígenes permitidos según `FRONTEND_URL`
- **Rate limiting:** Límite de peticiones por minuto
- **Validación:** Sanitización de inputs, validación de archivos (MIME, tamaño)
- **JWT:** Tokens firmados con claims de rol y buildingId
- **Aislamiento:** Cada tenant solo accede a sus propios datos (buildingId en queries)

## Documentación adicional

- [Documentación técnica completa](../../condominio/documentacion.md)
- [Plan SaaS Multi-Tenant](../../condominio/saas-multitenant-plan.md)
- [Memoria del agente](../../.cursor/rules/condominio.mdc)

## Licencia

Proyecto privado. Uso exclusivo para gestión de condominios.
