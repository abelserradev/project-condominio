# Documentación — Backend Condominio Residencia Sofia

Servidor que gestiona la lógica del sistema de condominio: base de datos, autenticación, pagos, recibos, avisos y archivos. Esta documentación está pensada para **usuarios finales**, **administradores** y **desarrolladores**.

---

## 1. ¿Qué es el backend?

El **backend** es el “motor” del sistema: procesa las peticiones del navegador, guarda la información en la base de datos y responde con los datos que el frontend muestra. Por ejemplo:

- Cuando un propietario reporta un pago, el backend guarda el pago y el comprobante.
- Cuando la administración acepta un pago, el backend actualiza los recibos.
- Cuando alguien consulta recibos o la tasa BCV, el backend devuelve esa información.

El backend no tiene interfaz gráfica: se usa a través de la web (frontend) o de herramientas técnicas (API).

---

## 2. ¿Qué hace el backend? (resumen para no técnicos)

| Función | Descripción |
|---------|-------------|
| **Autenticación** | Comprueba usuario y contraseña de administradores y emite el token de sesión. |
| **Recibos** | Crea y lista facturas por piso, apartamento y meses. Los propietarios pueden ver las pendientes sin iniciar sesión. |
| **Pagos** | Recibe los pagos reportados por los propietarios, guarda el comprobante y permite a la administración aceptarlos o rechazarlos. |
| **Tasa BCV** | Ofrece la tasa de cambio del día para conversiones USD/BS. |
| **Avisos** | Permite a la administración publicar avisos que los residentes pueden ver. |
| **Archivos** | Almacena y sirve comprobantes de pago e imágenes. |
| **Bancos** | Lista los bancos disponibles para elegir al reportar un pago. |

---

## 3. Requisitos para ejecutar (para técnicos)

- **Node.js** 18 o superior.
- **MongoDB** (local o en Docker).
- **npm** o **pnpm**.

---

## 4. Cómo poner en marcha el backend

### 4.1 Con Docker (recomendado)

```bash
cd backend/condomini
docker compose up --build
```

Esto levanta MongoDB y la API. La API queda en el puerto **3001**.

### 4.2 Sin Docker (solo la API)

1. Tener MongoDB corriendo (por ejemplo en `localhost:27017`).
2. Crear el archivo `.env` (ver sección 5).
3. Ejecutar:

```bash
cd backend/condomini
npm install
npm run start:dev
```

### 4.3 Servicios y puertos

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| API (backend) | 3001 | Servidor principal. |
| MongoDB | 27017 | Base de datos. |

---

## 5. Variables de entorno

Crear un archivo `.env` en `backend/condomini/` con al menos:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `MONGODB_URI` | Cadena de conexión a MongoDB. | `mongodb://localhost:27017/condominio` o `mongodb://mongodb:27017/condominio` (Docker) |
| `PORT` | Puerto donde escucha la API. | `3001` |
| `FRONTEND_URL` | URL del frontend (para CORS). | `http://localhost:3000` |
| `JWT_SECRET` | Clave secreta para los tokens de sesión. | Una cadena larga y aleatoria |
| `ADMIN_USUARIO` | Usuario del administrador. | `admin` |
| `ADMIN_PASSWORD` | Contraseña del administrador. | Una contraseña segura |

**Opcional (solo desarrollo):**

| Variable | Descripción |
|----------|-------------|
| `DISABLE_CSRF` | Si está definida, desactiva la protección CSRF (útil en desarrollo). |

**Importante:** No subir nunca archivos `.env` al repositorio. Contienen datos sensibles.

---

## 6. Endpoints principales (para desarrolladores)

### 6.1 Públicos (sin login)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/administracion/public/pendientes` | Recibos con saldo pendiente (para propietarios). |
| GET | `/tasa-bcv` | Tasa BCV del día. |
| GET | `/banks` | Lista de bancos. |
| GET | `/apartments` | Lista de apartamentos. |
| GET | `/avisos` | Lista de avisos publicados. |
| GET | `/csrf/token` | Token CSRF (para login y crear pagos). |
| POST | `/auth/login` | Login de administrador. |
| POST | `/payments` | Crear pago reportado (requiere token CSRF). |

### 6.2 Protegidos (requieren token JWT)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/payments` | Listar pagos. |
| GET | `/payments/:id` | Detalle de un pago. |
| PATCH | `/payments/:id/aceptar` | Aceptar pago. |
| PATCH | `/payments/:id/rechazar` | Rechazar pago. |
| GET | `/administracion/recibos` | Listar recibos (admin). |
| POST | `/administracion/recibos` | Crear recibo. |
| POST | `/avisos` | Crear aviso. |
| PATCH | `/avisos/:id` | Actualizar aviso. |
| DELETE | `/avisos/:id` | Eliminar aviso. |

---

## 7. Módulos del backend (para desarrolladores)

| Módulo | Responsabilidad |
|--------|-----------------|
| **Auth** | Login, JWT, CSRF en POST login. |
| **User** | Modelo y servicio de usuarios administradores. |
| **Payments** | CRUD de pagos, aceptar/rechazar, subida de comprobante. |
| **Administracion** | Recibos: crear, listar, filtrar; endpoint público de pendientes. |
| **Buildings** | Edificios. |
| **Apartments** | Apartamentos por piso (idUnico, piso, numero). |
| **Banks** | Bancos (con seed). |
| **Files** | Servir archivos (comprobantes, facturas); compresión de imágenes. |
| **Owners** | Propietarios. |
| **TasaBcv** | Tasa BCV del día (endpoint público). |
| **Avisos** | Avisos: crear, listar, actualizar, eliminar (admin); listar público. |
| **Common** | CSRF Guard, filtro de excepciones, utilidades (security, file-validation, password), cache. |

---

## 8. Seguridad implementada

- **CSRF:** Protección en login y en POST de pagos. Token desde `GET /csrf/token`.
- **CORS:** Orígenes permitidos según `FRONTEND_URL`.
- **Validación:** Validación y sanitización de entradas para evitar inyecciones.
- **Archivos:** Validación de tipo (MIME) y tamaño (máx. 5 MB).
- **Throttling:** Límite de peticiones por minuto para evitar abusos.
- **Helmet:** Cabeceras de seguridad HTTP.
- **Excepciones:** Respuestas de error unificadas; no se expone el stack en producción.

---

## 9. Estructura del proyecto

```
backend/condomini/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── auth/
│   ├── user/
│   ├── payments/
│   ├── administracion/
│   ├── avisos/
│   ├── buildings/
│   ├── apartments/
│   ├── banks/
│   ├── files/
│   ├── owners/
│   ├── tasa-bcv/
│   └── common/          # guards, filters, utils
├── scripts/              # p. ej. reset-admin-password
├── .env                  # NO subir al repositorio
└── DOCUMENTACION.md      # Este archivo
```

### 9.1 Tecnologías utilizadas

- **NestJS 11**
- **TypeScript**
- **MongoDB** (Mongoose)
- **Passport JWT**
- **CSRF** (csurf + cookie)
- **Helmet, Throttler, class-validator**
- **Multer** (archivos), **Sharp** (imágenes), **bcrypt**

---

## 10. Scripts útiles

### Resetear contraseña del administrador

```bash
cd backend/condomini
npm run reset-admin
```

Sigue las instrucciones en pantalla para definir una nueva contraseña.

---

## 11. Preguntas frecuentes

**¿Qué base de datos usa?**  
MongoDB. Se puede usar local o en Docker.

**¿Cómo cambio la contraseña del administrador?**  
Ejecuta el script `npm run reset-admin` en la carpeta del backend.

**¿Por qué falla la conexión desde otro dispositivo?**  
Revisa que `FRONTEND_URL` incluya la URL desde la que accedes (p. ej. `http://192.168.1.100:3000`) y que el firewall permita el puerto 3001.

**¿Dónde se guardan los comprobantes?**  
En la base de datos MongoDB (GridFS) o en el sistema de archivos, según la configuración del módulo Files.

---

## 12. Más información

- **Levantar todo el proyecto:** Ver `DOCKER.md` en la raíz del proyecto.
- **Frontend:** Ver `frontend/condominio/DOCUMENTACION.md`.
- **Reglas de desarrollo y memoria del agente:** Ver `.cursor/rules/AGENTS.md` en la raíz.
