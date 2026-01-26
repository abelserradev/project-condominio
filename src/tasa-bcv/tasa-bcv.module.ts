import { Module } from '@nestjs/common';
import { tasabcvcontroller } from './tasa-bcv.controller';
import { tasabcvservice } from './tasa-bcv.services';

@Module({
  controllers: [tasabcvcontroller],
  providers: [tasabcvservice],
})
export class tasabcvmodule {}   