/**
 * URL del portal del edificio según entorno.
 * Producción: slug.tuapp.com | Dev: slug.localhost:3000
 */
export function buildPortalUrl(slug: string): string {
  const rootDomain = process.env.PLATFORM_ROOT_DOMAIN?.trim();
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';

  if (rootDomain) {
    const protocol = rootDomain.includes('localhost') ? 'http' : 'https';
    return `${protocol}://${slug}.${rootDomain}`;
  }

  try {
    const parsed = new URL(frontendUrl);
    const host = parsed.hostname;
    const port = parsed.port ? `:${parsed.port}` : '';

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
