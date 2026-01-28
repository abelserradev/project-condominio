import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

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
        console.warn('[UserService] seedAdmin: Variables ADMIN_USUARIO o ADMIN_PASSWORD no configuradas');
        return;
      }
      if (usuario.length === 0) {
        console.warn('[UserService] seedAdmin: ADMIN_USUARIO está vacío después de trim');
        return;
      }
      const exists = await this.userModel.findOne({ usuario });
      if (exists) {
        console.log(`[UserService] seedAdmin: Usuario "${usuario}" ya existe, omitiendo creación`);
        if (process.env.ADMIN_RESET_PASSWORD === 'true') {
          console.log(`[UserService] seedAdmin: Actualizando contraseña para "${usuario}"`);
          const actualizado = await this.updatePassword(usuario, password);
          if (actualizado) {
            console.log(`[UserService] seedAdmin: Contraseña actualizada para "${usuario}"`);
          } else {
            console.warn(`[UserService] seedAdmin: No se pudo actualizar la contraseña para "${usuario}"`);
          }
        }
        return;
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const newUser = await this.userModel.create({ usuario, passwordHash, rol: 'admin' });
      console.log(`[UserService] seedAdmin: Usuario administrador "${usuario}" creado exitosamente (ID: ${newUser._id})`);
    } catch (error) {
      console.error('[UserService] seedAdmin: Error al crear usuario administrador:', error);
    }
  }
}