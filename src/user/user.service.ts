import { Injectable, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async findByUsuario(usuario: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ usuario }).lean().exec();
  }

  async findAdminByUsuarioAndBuilding(
    usuario: string,
    buildingId: Types.ObjectId,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findOne({
        usuario: usuario.trim().toLowerCase(),
        buildingId,
        isSuperAdmin: false,
        rol: 'admin',
      })
      .lean()
      .exec();
  }

  async findSuperAdminByUsuario(usuario: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({
        usuario: usuario.trim().toLowerCase(),
        isSuperAdmin: true,
      })
      .lean()
      .exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.userModel.findById(id).lean().exec();
  }

  async validatePassword(plain: string, storedHash: string): Promise<boolean> {
    return bcrypt.compare(plain, storedHash);
  }

  async updatePassword(
    userId: string,
    nuevaPassword: string,
  ): Promise<boolean> {
    if (!Types.ObjectId.isValid(userId)) return false;
    const passwordHash = await bcrypt.hash(nuevaPassword, 10);
    const result = await this.userModel.updateOne(
      { _id: userId },
      { passwordHash },
    );
    return result.modifiedCount > 0;
  }

  async createAdminForBuilding(data: {
    email: string;
    password: string;
    buildingId: Types.ObjectId;
  }): Promise<UserDocument> {
    const emailNorm = data.email.trim().toLowerCase();
    const existente = await this.userModel
      .findOne({ usuario: emailNorm, buildingId: data.buildingId })
      .lean();
    if (existente) {
      throw new ConflictException(
        'No se pudo completar el registro. Verifique los datos e intente de nuevo.',
      );
    }
    const passwordHash = await bcrypt.hash(data.password, 10);
    const doc = await this.userModel.create({
      usuario: emailNorm,
      email: emailNorm,
      passwordHash,
      rol: 'admin',
      buildingId: data.buildingId,
      isSuperAdmin: false,
    });
    return doc.toObject();
  }

  async findAdminByBuildingId(
    buildingId: Types.ObjectId,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ buildingId, isSuperAdmin: false, rol: 'admin' })
      .lean()
      .exec();
  }

  async resetAdminPasswordByBuilding(
    buildingId: Types.ObjectId,
    nuevaPassword: string,
  ): Promise<UserDocument | null> {
    const admin = await this.userModel
      .findOne({ buildingId, isSuperAdmin: false, rol: 'admin' })
      .exec();
    if (!admin) return null;
    admin.passwordHash = await bcrypt.hash(nuevaPassword, 10);
    await admin.save();
    return admin.toObject();
  }

  async ensureSuperAdmin(usuario: string, password: string): Promise<void> {
    const existente = await this.userModel.findOne({ usuario }).exec();
    const passwordHash = await bcrypt.hash(password, 10);
    if (existente) {
      await this.userModel.updateOne(
        { usuario },
        { $set: { isSuperAdmin: true, passwordHash, buildingId: null } },
      );
      return;
    }
    await this.userModel.create({
      usuario,
      passwordHash,
      rol: 'admin',
      isSuperAdmin: true,
    });
  }

  async existeSuperAdmin(): Promise<boolean> {
    const doc = await this.userModel
      .findOne({ isSuperAdmin: true })
      .lean()
      .exec();
    return doc !== null;
  }
}
