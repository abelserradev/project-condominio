/**
 * URL del portal del edificio según entorno.
 * Producción: slug.buildforge.work | Dev: slug.localhost:3000
 */

/** Coolify a veces inyecta FRONTEND_URL con el ID del contenedor (ej. 02dcbbf0a1e6) */
function esHostnamePublico(host: string): boolean {
  if (host === 'localhost' || host === '127.0.0.1') return true;
  if (!host.includes('.')) return false;
  if (/^[0-9a-f]{8,}$/i.test(host)) return false;
  return true;
}

export function buildPortalUrl(slug: string): string {
  const rootDomain = process.env.PLATFORM_ROOT_DOMAIN?.trim();
  const frontendUrl = (process.env.FRONTEND_URL ?? 'http://localhost:3000')
    .split(',')[0]
    .trim();

  if (rootDomain) {
    const protocol = rootDomain.includes('localhost') ? 'http' : 'https';
    return `${protocol}://${slug}.${rootDomain}`;
  }

  try {
    const parsed = new URL(frontendUrl);
    const host = parsed.hostname;
    const port = parsed.port ? `:${parsed.port}` : '';

    if (!esHostnamePublico(host)) {
      throw new Error('FRONTEND_URL apunta a hostname interno de Docker');
    }

    if (host === 'localhost' || host === '127.0.0.1') {
      return `${parsed.protocol}//${slug}.localhost${port}`;
    }

    const partes = host.split('.');
    if (partes.length >= 2) {
      const dominio = partes.slice(-2).join('.');
      return `${parsed.protocol}//${slug}.${dominio}${port}`;
    }
  } catch {
    // fallback abajo
  }

  return `${frontendUrl}?edificio=${slug}`;
}
