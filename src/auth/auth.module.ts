import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UserModule } from '../user/user.module';
import { OwnersModule } from '../owners/owners.module';
import { BuildingsModule } from '../buildings/buildings.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';

// Validar que JWT_SECRET esté definido al iniciar el módulo
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.trim() === '') {
  throw new Error(
    'JWT_SECRET debe estar definido en las variables de entorno. ' +
      'Genera uno seguro con: openssl rand -base64 32',
  );
}

@Module({
  imports: [
    UserModule,
    forwardRef(() => OwnersModule),
    forwardRef(() => BuildingsModule),
    PassportModule,
    JwtModule.register({
      secret: jwtSecret,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, JwtStrategy],
  exports: [JwtAuthGuard, JwtModule],
})
export class AuthModule {}
