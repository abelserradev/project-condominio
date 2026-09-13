import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Owner, OwnerDocument } from '../entities/owner.schema';
import type { OwnerLoginSnapshot, OwnersLoginPort } from './owners-login.port';

@Injectable()
export class OwnersLoginService implements OwnersLoginPort {
  constructor(
    @InjectModel(Owner.name)
    private readonly ownerModel: Model<OwnerDocument>,
  ) {}

  async findActiveByEmail(
    email: string,
    buildingId: Types.ObjectId,
  ): Promise<OwnerLoginSnapshot | null> {
    const doc = await this.ownerModel
      .findOne({
        email: email.toLowerCase().trim(),
        buildingId,
        activo: true,
      })
      .select('_id passwordHash rol piso apartamento idUnico')
      .lean()
      .exec();
    if (!doc?._id) {
      return null;
    }
    return {
      _id: doc._id,
      passwordHash: String(doc.passwordHash),
      rol: String(doc.rol),
      piso: Number(doc.piso),
      apartamento: Number(doc.apartamento),
      idUnico: String(doc.idUnico),
    };
  }
}
