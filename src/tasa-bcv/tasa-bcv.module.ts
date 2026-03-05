import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { TasaBcvController } from './tasa-bcv.controller';
import { TasaBcvService } from './tasa-bcv.services';

@Module({
  imports: [CommonModule],
  controllers: [TasaBcvController],
  providers: [TasaBcvService],
})
export class TasaBcvModule {}
