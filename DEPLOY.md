# Despliegue en producción: Coolify + Cloudflare

Dominio: **buildforge.work**

## Arquitectura

```
Usuario → buildforge.work (Cloudflare)
       → Cloudflare Tunnel → Coolify Proxy (Traefik)
       → Frontend (Next.js :3000) | API (NestJS :3001) | MongoDB
```

## Requisitos previos

- Dominio `buildforge.work` en Cloudflare
- Coolify instalado en servidor local
- Cloudflare Tunnel configurado (Zero Trust → Networks → Tunnels)

## Backend (este repo)

### Coolify: Docker Compose

1. **+ New** → Docker Compose
2. **Source**: Git → ruta a este repo / `backend/condomini`
3. **Compose file**: `docker-compose.prod.yml`
4. **Dominios** (servicio `api`): `http://api.buildforge.work:3001`
5. **Variables de entorno** (ver `.env.example`):

| Variable       | Valor producción                        |
|----------------|-----------------------------------------|
| MONGODB_URI    | mongodb://mongodb:27017/condominio      |
| FRONTEND_URL   | https://buildforge.work                 |
| JWT_SECRET     | `openssl rand -base64 32`               |
| ADMIN_USUARIO  | Condominio                              |
| ADMIN_PASSWORD | (contraseña segura)                     |
| SEED_ADMIN     | true                                    |

## Frontend (condominio-front)

### Coolify: Dockerfile

1. **+ New** → Dockerfile
2. **Source**: Git → repo frontend
3. **Dockerfile**: raíz del frontend
4. **Dominios**: `http://buildforge.work:3000`
5. **Build args / Env**: `NEXT_PUBLIC_API_URL=https://api.buildforge.work`

## Cloudflare

- **SSL/TLS**: Full (o Full Strict con certificado origen)
- **Always Use HTTPS**: activado
- **Tunnel hostnames**: `*` y `api` → `localhost:80` (o `localhost:443` si Full TLS)

## Verificación

- https://buildforge.work → frontend
- https://api.buildforge.work/csrf/token → API (GET debe responder JSON)
