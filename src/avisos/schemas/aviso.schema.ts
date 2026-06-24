import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AvisoDocument = HydratedDocument<Aviso>;

export const Aviso_tipos = [
  'evento',
  'inconveniente',
  'aviso_general',
  'comunicado_oficial',
] as const;
export type Aviso_tipo = (typeof Aviso_tipos)[number];

export const Aviso_prioridades = ['alta', 'media', 'baja'] as const;
export type Aviso_prioridad = (typeof Aviso_prioridades)[number];

export const Aviso_estados = ['publicado', 'borrador'] as const;
export type Aviso_estado = (typeof Aviso_estados)[number];

@Schema({ timestamps: true, collection: 'avisos' })
export class Aviso {
  @Prop({ type: Types.ObjectId, ref: 'Building', index: true })
  buildingId?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  titulo: string;

  @Prop({ required: true, trim: true })
  mensaje: string;

  @Prop({ type: String, required: true, enum: Aviso_tipos })
  tipo: Aviso_tipo;

  @Prop({
    type: String,
    required: true,
    enum: Aviso_prioridades,
    default: 'media',
  })
  prioridad: Aviso_prioridad;

  @Prop({
    type: String,
    required: true,
    enum: Aviso_estados,
    default: 'borrador',
  })
  estado: Aviso_estado;
}

export const AvisoSchema = SchemaFactory.createForClass(Aviso);
AvisoSchema.index({ buildingId: 1, createdAt: -1 });
