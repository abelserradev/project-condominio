# Configuración de OCR

El módulo OCR extrae datos de comprobantes de pago usando **Tesseract.js** (sin tokens, 100% local).

## Motor principal: Tesseract.js

- **Sin coste:** No consume tokens ni APIs externas.
- **Local:** Todo el procesamiento ocurre en el servidor.
- **Idiomas:** Español + inglés (`spa+eng`) para comprobantes venezolanos.

## Fallback: Ollama (banco por logo)

Cuando el comprobante muestra "Banco destino" pero no "Banco de envío", el parser no puede inferir el banco emisor desde el texto. En ese caso, si Ollama está disponible, se usa un modelo de visión (moondream) para identificar el banco a partir del logo en la imagen.

### Requisitos

1. **Ollama** corriendo (Docker o nativo).
2. **Modelo moondream:** `ollama pull moondream:1.8b`

### Docker

El `docker-compose.yml` incluye el servicio Ollama. La API se conecta a `http://ollama:11434` en la red interna.

```bash
docker compose up -d
docker exec -it condominio-ollama ollama pull moondream:1.8b
```

### Desarrollo local

Si corres el backend con `npm run start:dev` y Ollama en tu PC:

```bash
ollama pull moondream:1.8b
```

Por defecto usa `http://localhost:11434`. Para otro puerto, define `OLLAMA_URL` en `.env`.

### Variables

| Variable | Descripción | Default |
|----------|-------------|---------|
| `OLLAMA_URL` | URL base de Ollama | `http://localhost:11434` |
| `OLLAMA_OCR_TIMEOUT_MS` | Timeout en ms para la inferencia | `90000` |

### GPU local (AMD) vs producción (NVIDIA)

- **Local:** `docker-compose.yml` usa `mnccouk/ollama-gpu-rx580` para AMD. Ver `GPU_DRIVERS.md` para instalar ROCm.
- **Producción:** `docker-compose.prod.yml` usa `ollama/ollama` con NVIDIA. Ver `GPU_DRIVERS.md` para instalar NVIDIA Container Toolkit.

## Uso

No requiere configuración adicional para Tesseract. El OCR funciona al levantar el backend. Si Ollama no está disponible, el fallback de banco por logo se omite sin error.

Los datos extraídos incluyen: banco, fecha de pago, número de comprobante, monto en Bs y monto en USD (si aparece en la imagen).
