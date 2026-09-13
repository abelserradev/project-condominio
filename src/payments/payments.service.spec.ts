import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { PaymentsService } from './payments.service';
import { Payment } from './schemas/payment.schema';
import { FilesService } from '../files/files.service';
import { AdministracionService } from '../administracion/administracion.service';
import { CobranzaSnapshotService } from '../administracion/cobranza-snapshot.service';
import { CacheService } from '../common/cache.service';
import { OcrService } from '../ocr/ocr.service';

describe('PaymentsService — aislamiento multi-tenant', () => {
  let service: PaymentsService;
  const buildingA = new Types.ObjectId();
  const buildingB = new Types.ObjectId();

  const mockFind = jest.fn().mockReturnValue({
    sort: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      }),
    }),
  });

  const mockPaymentModel = {
    find: mockFind,
    findOne: jest.fn(),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  };

  const filesService = {
    upload: jest.fn().mockResolvedValue(new Types.ObjectId()),
  };
  const administracionService = {
    applyPagoAceptado: jest.fn().mockResolvedValue({ ids: [] }),
  };
  const cobranzaSnapshotService = { programarRebuild: jest.fn() };
  const cacheService = {
    generateKey: jest.fn().mockReturnValue('payments:k'),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn(),
    delete: jest.fn(),
    deletePattern: jest.fn(),
  };
  const ocrService = { registrarOcrLog: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockFind.mockClear();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getModelToken(Payment.name), useValue: mockPaymentModel },
        { provide: FilesService, useValue: filesService },
        { provide: AdministracionService, useValue: administracionService },
        {
          provide: CobranzaSnapshotService,
          useValue: cobranzaSnapshotService,
        },
        { provide: CacheService, useValue: cacheService },
        { provide: OcrService, useValue: ocrService },
      ],
    }).compile();

    service = module.get(PaymentsService);
  });

  it('findAll debe filtrar por buildingId del edificio A', async () => {
    await service.findAll({ buildingId: buildingA, estado: 'pendiente' });

    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({ buildingId: buildingA, estado: 'pendiente' }),
    );
  });

  it('findAll con edificio B no debe usar el buildingId de A', async () => {
    await service.findAll({ buildingId: buildingB });

    const calls = mockFind.mock.calls as Array<[Record<string, unknown>]>;
    const query = calls[0]?.[0] ?? {};
    expect(query.buildingId).toEqual(buildingB);
    expect(query.buildingId).not.toEqual(buildingA);
  });

  it('findAll sin buildingId no agrega filtro de tenant (legacy — evitar en prod)', async () => {
    await service.findAll({ estado: 'aceptado' });

    const calls = mockFind.mock.calls as Array<[Record<string, unknown>]>;
    const query = calls[0]?.[0] ?? {};
    expect(query.buildingId).toBeUndefined();
    expect(query.estado).toBe('aceptado');
  });
});

describe('PaymentsService — create y estados', () => {
  let service: PaymentsService;
  const buildingId = new Types.ObjectId();
  const paymentId = new Types.ObjectId();
  const fileId = new Types.ObjectId();

  const docToObject = jest.fn().mockReturnValue({
    _id: paymentId,
    buildingId,
    piso: 2,
    apartamento: 5,
    estado: 'pendiente',
    meses: [1],
    montoUsd: 100,
  });

  const mockPaymentModel = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn().mockResolvedValue({ toObject: docToObject }),
    findOneAndUpdate: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  };

  const filesService = { upload: jest.fn().mockResolvedValue(fileId) };
  const administracionService = {
    applyPagoAceptado: jest
      .fn()
      .mockResolvedValue({ ids: ['507f1f77bcf86cd799439011'] }),
  };
  const cobranzaSnapshotService = { programarRebuild: jest.fn() };
  const cacheService = {
    generateKey: jest.fn(),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn(),
    delete: jest.fn(),
    deletePattern: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getModelToken(Payment.name), useValue: mockPaymentModel },
        { provide: FilesService, useValue: filesService },
        { provide: AdministracionService, useValue: administracionService },
        {
          provide: CobranzaSnapshotService,
          useValue: cobranzaSnapshotService,
        },
        { provide: CacheService, useValue: cacheService },
        { provide: OcrService, useValue: { registrarOcrLog: jest.fn() } },
      ],
    }).compile();
    service = module.get(PaymentsService);
  });

  it('create sube comprobante y persiste pago pendiente', async () => {
    const buffer = Buffer.from('pdf');
    const actual = await service.create({
      buildingId,
      piso: 2,
      apartamento: 5,
      meses: [1, 2],
      banco: 'Banesco',
      fechaPago: '2026-01-15',
      numeroComprobante: 'ABC',
      montoUsd: 120,
      comprobanteBuffer: buffer,
      comprobanteFilename: 'pago.pdf',
    });

    expect(filesService.upload).toHaveBeenCalledWith(buffer, {
      filename: 'pago.pdf',
      mimetype: undefined,
    });
    expect(mockPaymentModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        buildingId,
        piso: 2,
        apartamento: 5,
        estado: 'pendiente',
        comprobanteFileId: fileId,
      }),
    );
    expect(actual.estado).toBe('pendiente');
    expect(cacheService.deletePattern).toHaveBeenCalledWith('payments:.*');
  });

  it('updateEstado rechazado no llama administracion', async () => {
    const leanDoc = {
      _id: paymentId,
      buildingId,
      piso: 1,
      apartamento: 1,
      meses: [],
      montoUsd: 50,
      fechaPago: new Date(),
      numeroComprobante: 'X',
      recibosPagados: [],
    };
    mockPaymentModel.findOneAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(leanDoc),
      }),
    });

    await service.updateEstado(paymentId.toString(), 'rechazado', buildingId);

    expect(administracionService.applyPagoAceptado).not.toHaveBeenCalled();
    expect(cobranzaSnapshotService.programarRebuild).toHaveBeenCalledWith(
      buildingId,
    );
  });

  it('updateEstado aceptado aplica pago en administracion', async () => {
    const leanDoc = {
      _id: paymentId,
      buildingId,
      piso: 3,
      apartamento: 8,
      meses: [4],
      montoUsd: 80,
      fechaPago: new Date('2026-02-01T12:00:00.000Z'),
      numeroComprobante: 'N-1',
      recibosPagados: [new Types.ObjectId()],
    };
    mockPaymentModel.findOneAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(leanDoc),
      }),
    });
    mockPaymentModel.findByIdAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(undefined),
    });

    await service.updateEstado(paymentId.toString(), 'aceptado', buildingId);

    expect(administracionService.applyPagoAceptado).toHaveBeenCalledWith(
      expect.objectContaining({
        buildingId,
        piso: 3,
        apartamento: 8,
        paymentId: paymentId.toString(),
      }),
    );
    expect(mockPaymentModel.findByIdAndUpdate).toHaveBeenCalled();
  });

  it('updateEstado lanza NotFound si el pago no existe', async () => {
    mockPaymentModel.findOneAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    });

    await expect(
      service.updateEstado(paymentId.toString(), 'aceptado', buildingId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
