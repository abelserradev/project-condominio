import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AbonoApartamentoDocument = HydratedDocument<AbonoApartamento>;

/**
 * Crédito a favor del propietario por apartamento.
 * Se genera cuando paga por encima de la deuda; se consume al aplicar a nuevos recibos.
 */
@Schema({ timestamps: true, collection: 'abono_apartamento' })
export class AbonoApartamento {
  @Prop({ type: Types.ObjectId, ref: 'Building', index: true })
  buildingId?: Types.ObjectId;

  @Prop({ required: true })
  piso: number;

  @Prop({ required: true })
  apartamento: number;

  @Prop({ required: true, default: 0 })
  monto: number;
}

export const AbonoApartamentoSchema = SchemaFactory.createForClass(AbonoApartamento);
AbonoApartamentoSchema.index({ buildingId: 1, piso: 1, apartamento: 1 }, { unique: true });
