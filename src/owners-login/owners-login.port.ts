import { Types } from 'mongoose';

/** Datos mínimos para emitir JWT de propietario — sin acoplar AuthModule a OwnersModule. */
export interface OwnerLoginSnapshot {
  _id: Types.ObjectId;
  passwordHash: string;
  rol: string;
  piso: number;
  apartamento: number;
  idUnico: string;
}

export interface OwnersLoginPort {
  findActiveByEmail(
    email: string,
    buildingId: Types.ObjectId,
  ): Promise<OwnerLoginSnapshot | null>;
}

export const OWNERS_LOGIN = Symbol('OWNERS_LOGIN');
