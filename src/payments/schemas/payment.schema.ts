import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type paymentdocument = HydratedDocument<Payment>;

@Schema({ timestamps: true, collection: 'payments' })
export class Payment {
  @Prop({ required: true })
  piso: number;

  @Prop({ required: true })
  apartamento: number;

  @Prop({ required: true })
  idUnico: string;

  @Prop({ required: true, type: [Number] })
  meses: number[];

  @Prop({ required: true })
  banco: string;

  @Prop({ required: true })
  fechaPago: Date;

  @Prop({ required: true })
  numeroComprobante: string;

  @Prop({ required: true })
  montoUsd: number;

  @Prop()
  montoBs?: number;

  @Prop()
  tasaBcv?: number;

  @Prop({ type: Types.ObjectId })
  comprobanteFileId?: Types.ObjectId;

  @Prop({ type: [Types.ObjectId], default: [] })
  recibosPagados?: Types.ObjectId[];

  @Prop({ default: 'pendiente', enum: ['pendiente', 'aceptado', 'pagado', 'rechazado'] })
  estado: string;
}

export const paymentschema = SchemaFactory.createForClass(Payment);

// Índices compuestos para queries comunes
paymentschema.index({ piso: 1, apartamento: 1, estado: 1 });
paymentschema.index({ createdAt: -1 });