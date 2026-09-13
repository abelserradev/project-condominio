import { Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { MailService } from './services/mail.service';
import { CsrfController } from './controllers/csrf.controller';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { UserModule } from '../user/user.module';

@Module({
  imports: [UserModule],
  controllers: [CsrfController],
  providers: [CacheService, MailService, SuperAdminGuard],
  exports: [CacheService, MailService, SuperAdminGuard],
})
export class CommonModule {}
