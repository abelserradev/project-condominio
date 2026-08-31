import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { CobranzaSnapshotService } from './cobranza-snapshot.service';
import { CobranzaSnapshot } from './schemas/cobranza-snapshot.schema';
import { CobranzaReportService } from './cobranza-report.service';
import { CacheService } from '../common/cache.service';

describe('CobranzaSnapshotService', () => {
  let service: CobranzaSnapshotService;
  const buildingId = new Types.ObjectId();

  const reporteBase = {
    generadoEn: '2026-08-31T18:00:00.000Z',
    resumen: { totalApartamentos: 2, alDia: 1, morosos: 1, enRevision: 0 },
    filas: [
      { piso: 1, apartamento: 1, categoria: 'al_dia' },
      { piso: 1, apartamento: 2, categoria: 'moroso' },
    ],
  };

  const mockSnapshotModel = {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    }),
  };

  const mockReportService = {
    build: jest.fn().mockResolvedValue(reporteBase),
  };

  const mockCache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCache.get.mockResolvedValue(null);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CobranzaSnapshotService,
        {
          provide: getModelToken(CobranzaSnapshot.name),
          useValue: mockSnapshotModel,
        },
        { provide: CobranzaReportService, useValue: mockReportService },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();
    service = module.get(CobranzaSnapshotService);
  });

  it('cold start: sin snapshot reconstruye, persiste y marca fuente rebuild', async () => {
    mockSnapshotModel.findOne.mockReturnValue({
      lean: () => ({ exec: () => Promise.resolve(null) }),
    });

    const reporte = await service.obtenerReporte(buildingId);

    expect(mockReportService.build).toHaveBeenCalledWith(buildingId);
    expect(mockSnapshotModel.findOneAndUpdate).toHaveBeenCalled();
    expect(reporte.fuente).toBe('rebuild');
    expect(reporte.resumen.morosos).toBe(1);
  });

  it('con snapshot existente sirve desde snapshot sin rebuild', async () => {
    mockSnapshotModel.findOne.mockReturnValue({
      lean: () => ({
        exec: () =>
          Promise.resolve({
            actualizadoEn: new Date('2026-08-31T17:00:00.000Z'),
            resumen: reporteBase.resumen,
            filas: reporteBase.filas,
          }),
      }),
    });

    const reporte = await service.obtenerReporte(buildingId);

    expect(mockReportService.build).not.toHaveBeenCalled();
    expect(reporte.fuente).toBe('snapshot');
    expect(reporte.actualizadoEn).toBe('2026-08-31T17:00:00.000Z');
  });

  it('sirve desde cache Redis sin tocar Mongo', async () => {
    mockCache.get.mockResolvedValue({
      ...reporteBase,
      actualizadoEn: reporteBase.generadoEn,
      fuente: 'snapshot',
    });

    const reporte = await service.obtenerReporte(buildingId);

    expect(mockSnapshotModel.findOne).not.toHaveBeenCalled();
    expect(reporte.fuente).toBe('cache');
  });

  it('rebuild persiste snapshot e invalida cache del edificio', async () => {
    await service.rebuild(buildingId);

    expect(mockSnapshotModel.findOneAndUpdate).toHaveBeenCalledWith(
      { buildingId },
      expect.objectContaining({ $inc: { version: 1 } }),
      expect.objectContaining({ upsert: true }),
    );
    expect(mockCache.delete).toHaveBeenCalledWith(
      `reporte:cobranza:${buildingId.toString()}`,
    );
  });
});
