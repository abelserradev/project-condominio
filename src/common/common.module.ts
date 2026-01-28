import { Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CsrfController } from './controllers/csrf.controller';

@Module({
  controllers: [CsrfController],
  providers: [CacheService],
  exports: [CacheService],
})
export class CommonModule {}
