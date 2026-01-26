import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true, collection: 'usuarios' })
export class User {
  @Prop({ required: true, unique: true })
  usuario: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ default: 'admin' })
  rol: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
