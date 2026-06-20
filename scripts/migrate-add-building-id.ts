/**
 * Script de migración — Fase 1 Multi-Tenant
 *
 * Asigna buildingId a todos los documentos existentes del edificio "Residencia Sofia".
 * Se ejecuta UNA SOLA VEZ antes de activar el modo multi-tenant en producción.
 *
 * Uso: npx ts-node scripts/migrate-add-building-id.ts
 *
 * Prerrequisitos:
 * 1. El edificio "residencia-sofia" debe existir en la colección buildings
 *    (crearlo manualmente si es necesario con el script create-initial-building.ts)
 * 2. MONGODB_URI debe estar en las variables de entorno
 */

import * as mongoose from 'mongoose';
import { Types } from 'mongoose';
import * as dotenv from 'dotenv';
import { getMongoUriForHostScripts, maskMongoUri } from './mongo-uri-for-host';

dotenv.config();

const MONGODB_URI = getMongoUriForHostScripts();
const SLUG_EDIFICIO_PRINCIPAL = process.env.SLUG_EDIFICIO ?? 'residencia-sofia';

// Schemas mínimos para las colecciones afectadas
const BuildingSchema = new mongoose.Schema({ slug: String, nombre: String }, { collection: 'buildings' });
const PaymentSchema = new mongoose.Schema({ buildingId: mongoose.Schema.Types.ObjectId }, { collection: 'payments' });
const ReciboSchema = new mongoose.Schema({ buildingId: mongoose.Schema.Types.ObjectId }, { collection: 'administracion' });
const ApartmentSchema = new mongoose.Schema({ buildingId: mongoose.Schema.Types.ObjectId }, { collection: 'apartamentos' });
const AbonoSchema = new mongoose.Schema({ buildingId: mongoose.Schema.Types.ObjectId }, { collection: 'abono_apartamento' });
const AvisoSchema = new mongoose.Schema({ buildingId: mongoose.Schema.Types.ObjectId }, { collection: 'avisos' });

type MigrationStats = {
  coleccion: string;
  actualizados: number;
  sinCambios: number;
};

async function migrar(): Promise<void> {
  console.log(`Conectando a MongoDB: ${MONGODB_URI.replace(/:([^:@/]+)@/, ':***@')}`);
  await mongoose.connect(MONGODB_URI);
  console.log('Conectado.\n');

  const BuildingModel = mongoose.model('MigBuilding', BuildingSchema);
  const PaymentModel = mongoose.model('MigPayment', PaymentSchema);
  const ReciboModel = mongoose.model('MigRecibo', ReciboSchema);
  const ApartmentModel = mongoose.model('MigApartment', ApartmentSchema);
  const AbonoModel = mongoose.model('MigAbono', AbonoSchema);
  const AvisoModel = mongoose.model('MigAviso', AvisoSchema);

  const building = await BuildingModel.findOne({ slug: SLUG_EDIFICIO_PRINCIPAL }).lean();
  if (!building) {
    console.error(`❌ Error: No se encontró el edificio con slug "${SLUG_EDIFICIO_PRINCIPAL}".`);
    console.error('Crea el edificio primero ejecutando: npx ts-node scripts/create-initial-building.ts');
    process.exit(1);
  }

  const bid = (building as { _id: Types.ObjectId })._id;
  console.log(`✅ Edificio encontrado: "${(building as { nombre: string }).nombre}" (${bid})\n`);
  console.log('Iniciando migración — asignando buildingId a documentos sin él...\n');

  const colecciones: Array<{ nombre: string; model: mongoose.Model<mongoose.Document> }> = [
    { nombre: 'Pagos (payments)', model: PaymentModel as mongoose.Model<mongoose.Document> },
    { nombre: 'Recibos (administracion)', model: ReciboModel as mongoose.Model<mongoose.Document> },
    { nombre: 'Apartamentos (apartamentos)', model: ApartmentModel as mongoose.Model<mongoose.Document> },
    { nombre: 'Abonos (abono_apartamento)', model: AbonoModel as mongoose.Model<mongoose.Document> },
    { nombre: 'Avisos (avisos)', model: AvisoModel as mongoose.Model<mongoose.Document> },
  ];

  const stats: MigrationStats[] = [];

  for (const { nombre, model } of colecciones) {
    const sinBuildingId = await model.countDocuments({ buildingId: { $exists: false } });
    if (sinBuildingId === 0) {
      stats.push({ coleccion: nombre, actualizados: 0, sinCambios: 0 });
      console.log(`  ⏭  ${nombre}: todos los documentos ya tienen buildingId`);
      continue;
    }

    const result = await model.updateMany(
      { buildingId: { $exists: false } },
      { $set: { buildingId: bid } },
    );

    stats.push({
      coleccion: nombre,
      actualizados: result.modifiedCount,
      sinCambios: sinBuildingId - result.modifiedCount,
    });

    console.log(`  ✅ ${nombre}: ${result.modifiedCount} documentos actualizados`);
  }

  console.log('\n--- Resumen de migración ---');
  stats.forEach((s) => {
    console.log(`  ${s.coleccion}: ${s.actualizados} actualizados, ${s.sinCambios} sin cambios`);
  });

  await mongoose.disconnect();
  console.log('\nMigración completada. Conexión cerrada.');
}

migrar().catch((err) => {
  console.error('Error durante la migración:', err);
  process.exit(1);
});
