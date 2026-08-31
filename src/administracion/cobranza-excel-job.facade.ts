import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Model, Types } from 'mongoose';
import * as express from 'express';
import {
  CobranzaReportJob,
  CobranzaReportJobDocument,
} from './schemas/cobranza-report-job.schema';
import { FilesService } from '../files/files.service';
import type { FiltroCobranza } from './cobranza-report.service';

export interface JobCreadoResponse {
  jobId: string;
  estado: 'pending';
  creadoEn: string;
}

export interface JobEstadoResponse {
  jobId: string;
  estado: 'pending' | 'ready' | 'failed';
  creadoEn: string;
  listoEn?: string;
  downloadUrl?: string;
  error?: string;
}

/**
 * Orquesta creación, consulta y descarga de jobs de Excel de cobranza.
 * Mantiene el buildingId aislado para que un admin no descargue jobs de otro edificio.
 */
@Injectable()
export class CobranzaExcelJobFacade {
  constructor(
    @InjectModel(CobranzaReportJob.name)
    private readonly jobModel: Model<CobranzaReportJobDocument>,
    @InjectQueue('cobranza-excel')
    private readonly excelQueue: Queue,
    private readonly filesService: FilesService,
  ) {}

  async crearJob(
    buildingId: Types.ObjectId,
    filtro: FiltroCobranza = 'todos',
  ): Promise<JobCreadoResponse> {
    const doc = await this.jobModel.create({
      buildingId,
      filtro,
      estado: 'pending',
    });

    await this.excelQueue.add(
      'generar-excel',
      { buildingId: buildingId.toString(), jobId: doc._id.toString(), filtro },
      { jobId: doc._id.toString() },
    );

    return {
      jobId: doc._id.toString(),
      estado: 'pending',
      creadoEn: (doc.createdAt ?? new Date()).toISOString(),
    };
  }

  async obtenerEstado(
    jobId: string,
    buildingId: Types.ObjectId,
  ): Promise<JobEstadoResponse> {
    if (!Types.ObjectId.isValid(jobId)) {
      throw new NotFoundException('Job no encontrado');
    }
    const doc = await this.jobModel
      .findOne({ _id: new Types.ObjectId(jobId), buildingId })
      .lean()
      .exec();
    if (!doc) {
      throw new NotFoundException('Job no encontrado');
    }

    const base: JobEstadoResponse = {
      jobId: doc._id.toString(),
      estado: doc.estado,
      creadoEn: (doc.createdAt ?? new Date()).toISOString(),
    };

    if (doc.estado === 'ready') {
      return {
        ...base,
        listoEn:
          doc.listoEn?.toISOString() ??
          (doc.updatedAt ?? new Date()).toISOString(),
        downloadUrl: `/administracion/reporte/cobranza/jobs/${doc._id.toString()}/download`,
      };
    }

    if (doc.estado === 'failed') {
      return {
        ...base,
        listoEn:
          doc.listoEn?.toISOString() ??
          (doc.updatedAt ?? new Date()).toISOString(),
        error: doc.error ?? 'Error desconocido',
      };
    }

    return base;
  }

  async descargar(
    jobId: string,
    buildingId: Types.ObjectId,
    res: express.Response,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(jobId)) {
      throw new NotFoundException('Job no encontrado');
    }
    const doc = await this.jobModel
      .findOne({ _id: new Types.ObjectId(jobId), buildingId })
      .lean()
      .exec();
    if (!doc) {
      throw new NotFoundException('Job no encontrado');
    }
    if (doc.estado !== 'ready') {
      throw new NotFoundException(
        'El archivo aún no está listo; consulta el estado del job.',
      );
    }
    if (!doc.fileId) {
      throw new NotFoundException('Archivo no encontrado');
    }

    const { stream, contentType, filename } = await this.filesService.getStream(
      doc.fileId.toString(),
    );
    const safeFilename = filename.replace(/[\r\n"]/g, '_');
    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeFilename}"`,
    );
    stream.pipe(res);
  }
}
