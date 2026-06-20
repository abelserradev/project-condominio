/**
 * Script para crear el primer edificio (Residencia Sofia) en la BD.
 * Se ejecuta antes del script de migración.
 *
 * Uso: npx ts-node scripts/create-initial-building.ts
 */

import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { getMongoUriForHostScripts, maskMongoUri } from './mongo-uri-for-host';

dotenv.config();

const MONGODB_URI = getMongoUriForHostScripts();

const BuildingSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    nombre: { type: String, required: true },
    direccion: String,
    totalPisos: { type: Number, required: true },
    apartamentosPorPiso: { type: Number, required: true },
    activo: { type: Boolean, default: true },
    estadoSuscripcion: { type: String, default: 'activo' },
    suscripcionHasta: Date,
    diasGracia: { type: Number, default: 3 },
    historialRenovaciones: { type: Array, default: [] },
  },
  { timestamps: true, collection: 'buildings' },
);

async function crearEdificio(): Promise<void> {
  console.log(`Conectando a ${MONGODB_URI.replace(/:([^:@/]+)@/, ':***@')}...`);
  await mongoose.connect(MONGODB_URI);

  const BuildingModel = mongoose.model('InitBuilding', BuildingSchema);

  const existente = await BuildingModel.findOne({ slug: 'residencia-sofia' }).lean();
  if (existente) {
    console.log('El edificio "residencia-sofia" ya existe en la BD. Nada que hacer.');
    await mongoose.disconnect();
    return;
  }

  const suscripcionHasta = new Date();
  suscripcionHasta.setFullYear(suscripcionHasta.getFullYear() + 1); // 1 año de suscripción inicial

  const building = await BuildingModel.create({
    slug: 'residencia-sofia',
    nombre: 'Condominio Residencia Sofia',
    direccion: 'Caracas, Venezuela',
    totalPisos: 10,
    apartamentosPorPiso: 4,
    activo: true,
    estadoSuscripcion: 'activo',
    suscripcionHasta,
  });

  console.log(`✅ Edificio creado:`);
  console.log(`   Nombre: ${building.nombre}`);
  console.log(`   Slug: ${building.slug}`);
  console.log(`   ID: ${(building as { _id: unknown })._id}`);
  console.log(`   Suscripción hasta: ${suscripcionHasta.toLocaleDateString()}`);
  console.log('\nAhora puedes ejecutar: npx ts-node scripts/migrate-add-building-id.ts');

  await mongoose.disconnect();
}

crearEdificio().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
