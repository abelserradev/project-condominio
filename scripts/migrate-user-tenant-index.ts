/**
 * Migración: índice único compuesto usuario + buildingId (multi-tenant).
 *
 * Local (con docker-compose levantado):
 *   MONGODB_URI="mongodb://localhost:27017/condominio" npx ts-node scripts/migrate-user-tenant-index.ts
 *
 * Coolify: terminal del servicio backend (MONGODB_URI ya definida en env).
 */
import mongoose from 'mongoose';

const COLLECTION = 'usuarios';

async function listarIndices(
  col: mongoose.mongo.Collection,
): Promise<mongoose.mongo.IndexDescriptionInfo[]> {
  try {
    return await col.indexes();
  } catch (err: unknown) {
    const code = (err as { code?: number }).code;
    if (code === 26) {
      // NamespaceNotFound — BD vacía o sin usuarios aún; crear índice crea la colección
      console.log(
        `Colección ${COLLECTION} aún no existe; se creará con el índice nuevo.`,
      );
      return [];
    }
    throw err;
  }
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/condominio';

  console.log('Conectando a MongoDB…');
  await mongoose.connect(uri);
  console.log(`Base de datos: ${mongoose.connection.name}`);

  const col = mongoose.connection.collection(COLLECTION);

  const indexes = await listarIndices(col);
  const tieneUsuarioUnico = indexes.some(
    (idx) => idx.name === 'usuario_1' && idx.unique === true,
  );

  if (tieneUsuarioUnico) {
    console.log('Eliminando índice global usuario_1…');
    await col.dropIndex('usuario_1');
  } else if (indexes.length > 0) {
    console.log('No hay índice usuario_1 global (ok).');
  }

  const indicesActuales =
    indexes.length > 0 ? indexes : await listarIndices(col);
  const tieneCompuesto = indicesActuales.some(
    (idx) => idx.name === 'usuario_1_buildingId_1',
  );

  if (!tieneCompuesto) {
    console.log('Creando índice usuario_1_buildingId_1…');
    await col.createIndex(
      { usuario: 1, buildingId: 1 },
      { unique: true, name: 'usuario_1_buildingId_1' },
    );
  } else {
    console.log('Índice usuario_1_buildingId_1 ya existe (ok).');
  }

  console.log('Migración completada.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
