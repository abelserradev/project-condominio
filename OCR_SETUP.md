# Configuración de OCR

El módulo OCR extrae datos de comprobantes de pago usando **Tesseract.js** (sin tokens, 100% local).

## Motor: Tesseract.js

- **Sin coste:** No consume tokens ni APIs externas.
- **Local:** Todo el procesamiento ocurre en el servidor.
- **Idiomas:** Español + inglés (`spa+eng`) para comprobantes venezolanos.

## Uso

No requiere configuración adicional. El OCR funciona al levantar el backend con `docker compose up` o `npm run start:dev`.

Los datos extraídos incluyen: banco, fecha de pago, número de comprobante, monto en Bs y monto en USD (si aparece en la imagen).
