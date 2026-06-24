/**
 * Resuelve JWT_SECRET sin exigir .env local en dev/test/CI de compilación.
 * En producción sigue siendo obligatorio — fail-fast al arrancar la app.
 */
export function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (secret) {
    return secret;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET debe estar definido en producción. ' +
        'Genera uno seguro con: openssl rand -base64 32',
    );
  }
  // Fallback solo fuera de prod: hooks pre-push, tests locales, nest build
  return 'dev-jwt-fallback-solo-local-y-ci';
}
