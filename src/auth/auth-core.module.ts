import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { resolveJwtSecret } from '../common/utils/jwt-secret.util';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';

/** JWT + guards sin AuthService ni dominio buildings/owners — rompe ciclo DI con BuildingsModule. */
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: resolveJwtSecret(),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  providers: [JwtAuthGuard, JwtStrategy],
  exports: [JwtAuthGuard, JwtModule, PassportModule],
})
export class AuthCoreModule {}
