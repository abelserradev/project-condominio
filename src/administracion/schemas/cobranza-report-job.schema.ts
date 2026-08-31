import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CobranzaReportJobDocument = HydratedDocument<CobranzaReportJob>;

export type EstadoReporteJob = 'pending' | 'ready' | 'failed';

/**
 * Job de generación asíncrona de Excel de cobranza.
 * Un documento por request; TTL opcional de 24 h para limpieza.
 */
@Schema({ timestamps: true, collection: 'cobranza_report_jobs' })
export class CobranzaReportJob {
  @Prop({ type: Types.ObjectId, ref: 'Building', required: true, index: true })
  buildingId: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['pending', 'ready', 'failed'],
    default: 'pending',
  })
  estado: EstadoReporteJob;

  @Prop({ type: String, enum: ['todos', 'al_dia', 'moroso'], default: 'todos' })
  filtro: string;

  @Prop({ type: Types.ObjectId, ref: 'File' })
  fileId?: Types.ObjectId;

  @Prop({ type: String })
  error?: string;

  @Prop({ type: Date })
  listoEn?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const CobranzaReportJobSchema =
  SchemaFactory.createForClass(CobranzaReportJob);

// TTL: borrar jobs listos o fallidos 24 h después de listoEn (REQ-013 cleanup).
// Los pending no tienen listoEn y no entran en el índice parcial.
CobranzaReportJobSchema.index(
  { listoEn: 1 },
  {
    expireAfterSeconds: 24 * 60 * 60,
    partialFilterExpression: { estado: { $in: ['ready', 'failed'] } },
  },
);
