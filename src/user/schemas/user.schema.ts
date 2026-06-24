import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true, collection: 'usuarios' })
export class User {
  @Prop({ required: true })
  usuario: string;

  // Email opcional — para autenticación por email en el sistema multi-tenant
  @Prop({ sparse: true })
  email?: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ default: 'admin' })
  rol: string;

  // buildingId null/undefined = SuperAdmin (acceso global)
  @Prop({ type: Types.ObjectId, ref: 'Building' })
  buildingId?: Types.ObjectId;

  @Prop({ default: false })
  isSuperAdmin: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ usuario: 1, buildingId: 1 }, { unique: true });
UserSchema.index({ email: 1, buildingId: 1 }, { sparse: true });
