import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BankDocument = HydratedDocument<Bank>;

@Schema({ timestamps: true, collection: 'banks' })
export class Bank {
  @Prop({ required: true, unique: true })
  nombre: string;

  @Prop({ default: true })
  activo: boolean;
}

export const BankSchema = SchemaFactory.createForClass(Bank);
