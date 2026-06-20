import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { PaymentsService } from './payments.service';
import { Payment } from './schemas/payment.schema';
import { FilesService } from '../files/files.service';
import { AdministracionService } from '../administracion/administracion.service';
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
  };

  beforeEach(async () => {
    mockFind.mockClear();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getModelToken(Payment.name), useValue: mockPaymentModel },
        { provide: FilesService, useValue: {} },
        { provide: AdministracionService, useValue: {} },
        {
          provide: CacheService,
          useValue: { generateKey: () => 'k', get: () => null, set: () => {} },
        },
        { provide: OcrService, useValue: {} },
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
