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
import { resolveJwtSecret } from '../common/utils/jwt-secret.util';

@Module({
  imports: [
    UserModule,
    forwardRef(() => OwnersModule),
    forwardRef(() => BuildingsModule),
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: resolveJwtSecret(),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, JwtStrategy],
  exports: [JwtAuthGuard, JwtModule],
})
export class AuthModule {}
