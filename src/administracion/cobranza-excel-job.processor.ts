import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  CobranzaExcelJobService,
  type ExcelJobPayload,
} from './cobranza-excel-job.service';

/**
 * Consumer BullMQ para la cola de Excel de cobranza.
 * El worker es un adapter: delega la lógica de negocio en CobranzaExcelJobService.
 */
@Processor('cobranza-excel', { concurrency: 2 })
export class CobranzaExcelJobProcessor extends WorkerHost {
  constructor(
    private readonly cobranzaExcelJobService: CobranzaExcelJobService,
  ) {
    super();
  }

  async process(job: Job<ExcelJobPayload>): Promise<void> {
    await this.cobranzaExcelJobService.procesar(job);
  }
}
