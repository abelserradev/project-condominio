import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UserService implements OnModuleInit {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async onModuleInit(): Promise<void> {
    await this.seedAdmin();
  }

  async findByUsuario(usuario: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ usuario }).lean();
  }

  async validatePassword(plain: string, storedHash: string): Promise<boolean> {
    return bcrypt.compare(plain, storedHash);
  }

  async seedAdmin(): Promise<void> {
    const usuario = process.env.ADMIN_USUARIO?.trim();
    const password = process.env.ADMIN_PASSWORD;
    if (!usuario || !password) {
      console.log('[UserService] seedAdmin: Variables ADMIN_USUARIO o ADMIN_PASSWORD no configuradas');
      return;
    }
    const exists = await this.userModel.findOne({ usuario });
    if (exists) {
      console.log(`[UserService] seedAdmin: Usuario "${usuario}" ya existe, omitiendo creación`);
      // Si se necesita actualizar la contraseña, usar ADMIN_RESET_PASSWORD=true
      if (process.env.ADMIN_RESET_PASSWORD === 'true') {
        console.log(`[UserService] seedAdmin: Actualizando contraseña para "${usuario}"`);
        const passwordHash = await bcrypt.hash(password, 10);
        await this.userModel.updateOne({ usuario }, { passwordHash });
        console.log(`[UserService] seedAdmin: Contraseña actualizada para "${usuario}"`);
      }
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await this.userModel.create({ usuario, passwordHash, rol: 'admin' });
    console.log(`[UserService] seedAdmin: Usuario administrador "${usuario}" creado exitosamente`);
  }
}