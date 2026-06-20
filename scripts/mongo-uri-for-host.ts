/**
 * Los scripts (migrate, seed, create-superadmin) corren en el HOST, no en Docker.
 * El .env del API usa hostnames internos (mongodb:27017); aquí los mapeamos al puerto expuesto.
 */
export function getMongoUriForHostScripts(): string {
  const raw =
    process.env.MONGODB_URI_SCRIPT ??
    process.env.MONGODB_URI ??
    'mongodb://localhost:27017/condominio';

  // docker-compose.yml publica Mongo en 27018 → 27017
  if (raw.includes('@mongodb:')) {
    const hostUri = raw.replace('@mongodb:27017', '@localhost:27018');
    if (hostUri !== raw) {
      console.log(
        '[script] MONGODB_URI apunta a Docker; conectando vía localhost:27018 (desde el host)',
      );
    }
    return hostUri;
  }

  return raw;
}

export function maskMongoUri(uri: string): string {
  return uri.replace(/:([^:@/]+)@/, ':***@');
}
