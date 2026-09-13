import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { Owner } from '../entities/owner.schema';
import { OwnersLoginService } from './owners-login.service';

describe('OwnersLoginService', () => {
  let service: OwnersLoginService;
  const buildingId = new Types.ObjectId();
  const findOneChain = {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  };
  const ownerModel = { findOne: jest.fn().mockReturnValue(findOneChain) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OwnersLoginService,
        { provide: getModelToken(Owner.name), useValue: ownerModel },
      ],
    }).compile();
    service = module.get(OwnersLoginService);
    jest.clearAllMocks();
  });

  it('findActiveByEmail normaliza email y filtra activos', async () => {
    findOneChain.exec.mockResolvedValue({
      _id: new Types.ObjectId(),
      passwordHash: 'hash',
      rol: 'propietario',
      piso: 2,
      apartamento: 4,
      idUnico: 'P2-A4',
    });

    await service.findActiveByEmail('  User@Mail.COM ', buildingId);

    expect(ownerModel.findOne).toHaveBeenCalledWith({
      email: 'user@mail.com',
      buildingId,
      activo: true,
    });
  });
});
