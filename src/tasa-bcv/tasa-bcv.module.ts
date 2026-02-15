import { Module } from '@nestjs/common';
import { TasaBcvController } from './tasa-bcv.controller';
import { TasaBcvService } from './tasa-bcv.services';

@Module({
  controllers: [TasaBcvController],
  providers: [TasaBcvService],
})
export class TasaBcvModule {}
