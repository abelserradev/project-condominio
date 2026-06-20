import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type apartmentdocument = HydratedDocument<Apartment>;

@Schema({ timestamps: true, collection: 'apartamentos'})
export class Apartment {
    @Prop({ required: true, type: Types.ObjectId, ref: 'Building', index: true })
    buildingId: Types.ObjectId;

    @Prop({ required: true})
    piso: number;

    @Prop({ required: true})
    numero: number;

    @Prop({ required: true})
    idUnico: string;
}

export const apartmentschema = SchemaFactory.createForClass(Apartment);

// buildingId como primer campo del índice compuesto — garantiza aislamiento entre tenants
apartmentschema.index({ buildingId: 1, piso: 1, numero: 1 }, { unique: true });
apartmentschema.index({ buildingId: 1, idUnico: 1 });
