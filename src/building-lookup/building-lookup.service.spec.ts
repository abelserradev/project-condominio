import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Building } from '../entities/building.schema';
import { BuildingLookupService } from './building-lookup.service';

describe('BuildingLookupService', () => {
  let service: BuildingLookupService;
  const findOneChain = {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  };
  const buildingModel = {
    findOne: jest.fn().mockReturnValue(findOneChain),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BuildingLookupService,
        {
          provide: getModelToken(Building.name),
          useValue: buildingModel,
        },
      ],
    }).compile();
    service = module.get(BuildingLookupService);
    jest.clearAllMocks();
  });

  it('findBySlug normaliza slug y devuelve snapshot', async () => {
    findOneChain.exec.mockResolvedValue({
      _id: '507f1f77bcf86cd799439011',
      nombre: 'Torre Norte',
      slug: 'torre-norte',
    });

    const actual = await service.findBySlug('  Torre-Norte ');

    expect(buildingModel.findOne).toHaveBeenCalledWith({
      slug: 'torre-norte',
    });
    expect(actual?.nombre).toBe('Torre Norte');
  });

  it('findBySlug devuelve null si no hay documento', async () => {
    findOneChain.exec.mockResolvedValue(null);
    await expect(service.findBySlug('x')).resolves.toBeNull();
  });
});
