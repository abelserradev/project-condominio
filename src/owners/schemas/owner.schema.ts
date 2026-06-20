import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OwnerDocument = HydratedDocument<Owner>;

@Schema({ timestamps: true, collection: 'owners' })
export class Owner {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Building' })
  buildingId: Types.ObjectId;

  @Prop({ required: true })
  nombre: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true })
  piso: number;

  @Prop({ required: true })
  apartamento: number;

  // Identificador derivado: "P{piso}-A{apartamento}"
  @Prop({ required: true })
  idUnico: string;

  @Prop({ default: 'propietario', enum: ['propietario', 'inquilino'] })
  rol: string;

  @Prop({ default: true })
  activo: boolean;
}

export const OwnerSchema = SchemaFactory.createForClass(Owner);

// Email único dentro de un mismo edificio — puede repetirse entre edificios
OwnerSchema.index({ buildingId: 1, email: 1 }, { unique: true });
OwnerSchema.index({ buildingId: 1, piso: 1, apartamento: 1 });
