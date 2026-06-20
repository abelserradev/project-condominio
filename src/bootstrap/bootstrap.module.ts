import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { BootstrapService } from './bootstrap.service';

@Module({
  imports: [UserModule],
  providers: [BootstrapService],
})
export class BootstrapModule {}
