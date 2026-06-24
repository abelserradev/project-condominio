import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type BuildingDocument = HydratedDocument<Building>;

export type RenovacionEntry = {
  fecha: Date;
  renovadoPor: string;
  diasAgregados: number;
  nota?: string;
};

@Schema({ timestamps: true, collection: 'buildings' })
export class Building {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug: string;

  @Prop({ required: true })
  nombre: string;

  @Prop()
  direccion?: string;

  @Prop({ required: true })
  totalPisos: number;

  @Prop({ required: true })
  apartamentosPorPiso: number;

  @Prop({ default: true })
  activo: boolean;

  @Prop({
    default: 'trial',
    enum: ['trial', 'activo', 'vencido', 'suspendido'],
  })
  estadoSuscripcion: string;

  @Prop({ type: Date })
  suscripcionHasta: Date;

  @Prop({ default: 3 })
  diasGracia: number;

  // Texto libre con instrucciones de pago para el administrador del edificio
  @Prop()
  datosContactoPago?: string;

  // Historial de renovaciones para auditoría — quién renovó, cuándo y por cuánto
  @Prop({
    type: [
      {
        fecha: Date,
        renovadoPor: String,
        diasAgregados: Number,
        nota: String,
      },
    ],
    default: [],
  })
  historialRenovaciones: RenovacionEntry[];

  @Prop({ type: Types.ObjectId })
  reglamentoFileId?: Types.ObjectId;

  @Prop()
  reglamentoNombre?: string;

  @Prop({ type: Date })
  reglamentoActualizadoEn?: Date;
}

export const BuildingSchema = SchemaFactory.createForClass(Building);
// El índice único en slug ya está declarado con @Prop({ unique: true }) — no duplicar aquí
