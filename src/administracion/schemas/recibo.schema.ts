import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ReciboDocument = HydratedDocument<Recibo>;

@Schema({ _id: false })
export class Abono {
  @Prop({ required: true, type: Types.ObjectId })
  paymentId: Types.ObjectId;

  @Prop({ required: true })
  monto: number;

  @Prop({ required: true })
  fecha: Date;

  @Prop()
  numeroComprobante?: string;
}

@Schema({ timestamps: true, collection: 'administracion' })
export class Recibo {
  @Prop({ required: true })
  piso: number;

  @Prop({ required: true })
  apartamento: number;

  @Prop({ required: true })
  idUnico: string;

  @Prop({ required: true, type: [Number] })
  meses: number[];

  @Prop({ required: true })
  montoUsd: number;

  @Prop({ required: true })
  tipoDeuda: string;

  @Prop({ required: true })
  fechaReportada: Date;

  @Prop({ type: Types.ObjectId })
  facturaFileId?: Types.ObjectId;

  @Prop({ default: 'pendiente', enum: ['pendiente', 'pagado'] })
  estado: string;

  @Prop({ default: 0 })
  montoPagado: number;

  @Prop({ type: [Abono], default: [] })
  abonos: Abono[];
}

export const ReciboSchema = SchemaFactory.createForClass(Recibo);

// Índices compuestos para queries comunes
ReciboSchema.index({ piso: 1, apartamento: 1, estado: 1 });
ReciboSchema.index({ createdAt: -1 });
