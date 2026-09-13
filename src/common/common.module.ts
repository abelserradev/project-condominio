import { Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CsrfController } from './controllers/csrf.controller';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { UserModule } from '../user/user.module';
import { MailModule } from './mail.module';

@Module({
  imports: [UserModule, MailModule],
  controllers: [CsrfController],
  providers: [CacheService, SuperAdminGuard],
  exports: [CacheService, MailModule, SuperAdminGuard],
})
export class CommonModule {}
