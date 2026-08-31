import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  CobranzaExcelJobService,
  type ExcelJobPayload,
} from './cobranza-excel-job.service';

const workerConcurrency = Number.parseInt(
  process.env.COBRANZA_EXCEL_WORKER_CONCURRENCY ?? '2',
  10,
);

/**
 * Consumer BullMQ para la cola de Excel de cobranza.
 * Concurrencia configurable vía COBRANZA_EXCEL_WORKER_CONCURRENCY (default 2).
 */
@Processor('cobranza-excel', {
  concurrency: Number.isFinite(workerConcurrency) ? workerConcurrency : 2,
})
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
