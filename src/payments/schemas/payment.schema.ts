import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type paymentdocument = HydratedDocument<Payment>;

@Schema({ timestamps: true, collection: 'payments' })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'Building', index: true })
  buildingId?: Types.ObjectId;

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

// buildingId al frente del índice compuesto — crítico para aislamiento multi-tenant
paymentschema.index({ buildingId: 1, piso: 1, apartamento: 1, estado: 1 });
paymentschema.index({ buildingId: 1, createdAt: -1 });
