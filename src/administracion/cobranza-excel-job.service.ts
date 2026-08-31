import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Job } from 'bullmq';
import { buildCobranzaWorkbook } from './utils/cobranza-excel.util';
import { FilesService } from '../files/files.service';
import {
  CobranzaReportJob,
  CobranzaReportJobDocument,
  EstadoReporteJob,
} from './schemas/cobranza-report-job.schema';
import {
  CobranzaSnapshot,
  CobranzaSnapshotDocument,
} from './schemas/cobranza-snapshot.schema';

/** Payload de un job BullMQ para generar Excel de cobranza */
export interface ExcelJobPayload {
  buildingId: string;
  jobId: string;
  filtro: 'todos' | 'al_dia' | 'moroso';
}

/**
 * Worker para jobs de Excel de cobranza. Lee el snapshot ya construido
 * (no recalcula desde cero) para que el worker sea rápido y liviano.
 */
@Injectable()
export class CobranzaExcelJobService {
  private readonly logger = new Logger(CobranzaExcelJobService.name);

  constructor(
    @InjectModel(CobranzaReportJob.name)
    private readonly jobModel: Model<CobranzaReportJobDocument>,
    @InjectModel(CobranzaSnapshot.name)
    private readonly snapshotModel: Model<CobranzaSnapshotDocument>,
    private readonly filesService: FilesService,
  ) {}

  async procesar(job: Job<ExcelJobPayload>): Promise<void> {
    const { jobId, buildingId, filtro } = job.data;
    const start = Date.now();
    this.logger.log(`Procesando job Excel ${jobId}`);

    try {
      const snapshot = await this.snapshotModel
        .findOne({ buildingId: new Types.ObjectId(buildingId) })
        .lean()
        .exec();
      if (!snapshot) {
        throw new NotFoundException(
          'No existe snapshot de cobranza; solicita primero el reporte JSON.',
        );
      }

      const filas =
        filtro === 'todos'
          ? snapshot.filas
          : snapshot.filas.filter(
              (f) => (f as { categoria?: string }).categoria === filtro,
            );
      const buffer = await buildCobranzaWorkbook({
        generadoEn: snapshot.actualizadoEn.toISOString(),
        resumen: snapshot.resumen,
        filas: filas as never,
      });
      const fecha = snapshot.actualizadoEn.toISOString().slice(0, 10);
      const fileId = await this.filesService.upload(buffer, {
        filename: `reporte-cobranza-${fecha}.xlsx`,
        mimetype:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      await this.actualizarEstado(new Types.ObjectId(jobId), 'ready', fileId);
      this.logger.log(
        `Job Excel ${jobId} listo en ${Date.now() - start}ms (fileId: ${fileId.toString()})`,
      );
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : String(err);
      await this.actualizarEstado(
        new Types.ObjectId(jobId),
        'failed',
        undefined,
        mensaje,
      );
      this.logger.error(`Job Excel ${jobId} falló: ${mensaje}`);
      throw err;
    }
  }

  private async actualizarEstado(
    jobId: Types.ObjectId,
    estado: EstadoReporteJob,
    fileId?: Types.ObjectId,
    error?: string,
  ): Promise<void> {
    await this.jobModel
      .findByIdAndUpdate(jobId, {
        $set: {
          estado,
          fileId,
          error,
          listoEn:
            estado === 'ready' || estado === 'failed' ? new Date() : undefined,
        },
      })
      .exec();
  }
}
