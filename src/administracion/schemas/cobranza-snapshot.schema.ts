import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, Schema as MongooseSchema } from 'mongoose';

export type CobranzaSnapshotDocument = HydratedDocument<CobranzaSnapshot>;

/**
 * Read model del reporte de cobranza: 1 documento por edificio.
 * Se reconstruye async tras escrituras (recibo/pago/abono) para que el
 * resumen admin y el JSON del reporte no recalculen 5 colecciones por request.
 * Ver changes/2026-08-cobranza-read-model/delta-spec.md (REQ-011…015).
 */
@Schema({ timestamps: true, collection: 'cobranza_snapshot' })
export class CobranzaSnapshot {
  @Prop({ type: Types.ObjectId, ref: 'Building', required: true, unique: true })
  buildingId: Types.ObjectId;

  @Prop({ required: true })
  actualizadoEn: Date;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  resumen: {
    totalApartamentos: number;
    alDia: number;
    morosos: number;
    enRevision: number;
  };

  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  filas: Record<string, unknown>[];

  @Prop({ default: 1 })
  version: number;
}

export const CobranzaSnapshotSchema =
  SchemaFactory.createForClass(CobranzaSnapshot);
