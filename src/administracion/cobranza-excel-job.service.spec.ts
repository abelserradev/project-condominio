/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Job } from 'bullmq';
import { CobranzaExcelJobService } from './cobranza-excel-job.service';
import { FilesService } from '../files/files.service';
import {
  CobranzaReportJob,
  type CobranzaReportJobDocument,
} from './schemas/cobranza-report-job.schema';
import {
  CobranzaSnapshot,
  type CobranzaSnapshotDocument,
} from './schemas/cobranza-snapshot.schema';

type ExecFn = () => Promise<unknown>;

function mockJobModel() {
  return {
    findByIdAndUpdate: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(null) as ExecFn,
    }),
  } as unknown as jest.Mocked<Model<CobranzaReportJobDocument>>;
}

describe('CobranzaExcelJobService', () => {
  let service: CobranzaExcelJobService;
  let filesService: jest.Mocked<FilesService>;
  let snapshotModel: jest.Mocked<Model<CobranzaSnapshotDocument>>;
  let jobModel: jest.Mocked<Model<CobranzaReportJobDocument>>;

  const buildingId = new Types.ObjectId();
  const jobId = new Types.ObjectId();

  beforeEach(async () => {
    filesService = {
      upload: jest.fn(),
    } as unknown as jest.Mocked<FilesService>;

    snapshotModel = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Model<CobranzaSnapshotDocument>>;

    jobModel = mockJobModel();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CobranzaExcelJobService,
        { provide: getModelToken(CobranzaReportJob.name), useValue: jobModel },
        {
          provide: getModelToken(CobranzaSnapshot.name),
          useValue: snapshotModel,
        },
        { provide: FilesService, useValue: filesService },
      ],
    }).compile();

    service = module.get(CobranzaExcelJobService);
  });

  it('should upload workbook and mark job ready when snapshot exists', async () => {
    const snapshot = {
      _id: new Types.ObjectId(),
      actualizadoEn: new Date('2026-08-31T00:00:00Z'),
      resumen: { totalApartamentos: 1, alDia: 1, morosos: 0, enRevision: 0 },
      filas: [],
      version: 1,
    } as unknown as CobranzaSnapshotDocument;

    snapshotModel.findOne.mockReturnValue({
      lean: () => ({ exec: () => Promise.resolve(snapshot) }),
    } as unknown as ReturnType<Model<CobranzaSnapshotDocument>['findOne']>);
    filesService.upload.mockResolvedValue(new Types.ObjectId());

    const job = {
      data: {
        buildingId: buildingId.toString(),
        jobId: jobId.toString(),
        filtro: 'todos',
      },
    } as Job<{ buildingId: string; jobId: string; filtro: 'todos' }>;

    await service.procesar(job);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(filesService.upload).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(jobModel.findByIdAndUpdate).toHaveBeenCalledWith(
      jobId,
      expect.objectContaining({
        $set: expect.objectContaining({ estado: 'ready' }),
      }),
    );
  });

  it('should mark job failed when snapshot is missing', async () => {
    snapshotModel.findOne.mockReturnValue({
      lean: () => ({ exec: () => Promise.resolve(null) }),
    } as unknown as ReturnType<Model<CobranzaSnapshotDocument>['findOne']>);

    const job = {
      data: {
        buildingId: buildingId.toString(),
        jobId: jobId.toString(),
        filtro: 'todos',
      },
    } as Job<{ buildingId: string; jobId: string; filtro: 'todos' }>;

    await expect(service.procesar(job)).rejects.toThrow();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(jobModel.findByIdAndUpdate).toHaveBeenCalledWith(
      jobId,
      expect.objectContaining({
        $set: expect.objectContaining({ estado: 'failed' }),
      }),
    );
  });
});
