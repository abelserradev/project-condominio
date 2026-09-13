import { Module } from '@nestjs/common';
import { MailService } from './services/mail.service';

/** Mail aislado para que BuildingsModule no importe CommonModule (Phase 3 / depcruise). */
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
