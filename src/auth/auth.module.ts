import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { OwnersLoginModule } from '../owners-login/owners-login.module';
import { BuildingLookupModule } from '../building-lookup/building-lookup.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthCoreModule } from './auth-core.module';

@Module({
  imports: [
    UserModule,
    OwnersLoginModule,
    BuildingLookupModule,
    AuthCoreModule,
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthCoreModule, AuthService],
})
export class AuthModule {}
