import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OcrLogDocument = HydratedDocument<OcrLog>;

@Schema({ timestamps: true, collection: 'ocr_logs' })
export class OcrLog {
  @Prop({ type: Types.ObjectId, required: true })
  comprobanteFileId: Types.ObjectId;

  @Prop({ type: Object, required: true })
  prediccionMoondream: {
    banco?: string;
    montoBs?: number;
    fechaPago?: string;
    numeroComprobante?: string;
  };

  @Prop({ type: Object, required: true })
  datosRealesUsuario: {
    banco: string;
    montoBs?: number;
    fechaPago: string;
    numeroComprobante: string;
  };

  @Prop()
  textoCrudoRespuesta?: string;

  @Prop({ required: true, default: false })
  esCorrecto: boolean;
}

export const OcrLogSchema = SchemaFactory.createForClass(OcrLog);
OcrLogSchema.index({ createdAt: -1 });
