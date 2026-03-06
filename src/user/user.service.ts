import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { validatePasswordStrength } from '../common/utils/password.util';

@Injectable()
export class UserService implements OnModuleInit {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async onModuleInit(): Promise<void> {
    // Solo ejecutar seed si la variable SEED_ADMIN está habilitada
    if (process.env.SEED_ADMIN !== 'false') {
      await this.seedAdmin();
    }
  }

  async findByUsuario(usuario: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ usuario }).lean().exec();
  }

  async validatePassword(plain: string, storedHash: string): Promise<boolean> {
    return bcrypt.compare(plain, storedHash);
  }

  async updatePassword(usuario: string, nuevaPassword: string): Promise<boolean> {
    const passwordHash = await bcrypt.hash(nuevaPassword, 10);
    const result = await this.userModel.updateOne({ usuario }, { passwordHash });
    return result.modifiedCount > 0;
  }

  async seedAdmin(): Promise<void> {
    try {
      const usuario = process.env.ADMIN_USUARIO?.trim();
      const password = process.env.ADMIN_PASSWORD;
      if (!usuario || !password) {
        return;
      }
      if (usuario.length === 0) {
        return;
      }
      const exists = await this.userModel.findOne({ usuario });
      if (exists) {
        if (process.env.ADMIN_RESET_PASSWORD === 'true') {
          await this.updatePassword(usuario, password);
        }
        return;
      }
      if (process.env.ADMIN_RESET_PASSWORD !== 'true') {
        validatePasswordStrength(password);
      }
      const passwordHash = await bcrypt.hash(password, 10);
      await this.userModel.create({ usuario, passwordHash, rol: 'admin' });
    } catch {
      // Error genérico; no exponer detalles que puedan incluir info sensible
    }
  }
}