import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type apartmentdocument = HydratedDocument<Apartment>;

@Schema({ timestamps: true, collection: 'apartamentos'})
export class Apartment {
    @Prop({ required: true})
    piso: number;

    @Prop({ required: true})
    numero: number;

    @Prop({ required: true})
    idUnico: string;
}

export const apartmentschema = SchemaFactory.createForClass(Apartment);

apartmentschema.index({piso: 1, numero: 1}, {unique: true});

