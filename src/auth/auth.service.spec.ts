import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { Types } from 'mongoose';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));
import { BUILDING_LOOKUP } from '../building-lookup/building-lookup.port';
import { OWNERS_LOGIN } from '../owners-login/owners-login.port';
import { UserService } from '../user/user.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  const buildingId = new Types.ObjectId();
  const userId = new Types.ObjectId();

  const userService = {
    findAdminByUsuarioAndBuilding: jest.fn(),
    findSuperAdminByUsuario: jest.fn(),
    validatePassword: jest.fn(),
  };
  const ownersLogin = {
    findActiveByEmail: jest.fn(),
  };
  const buildingLookup = {
    findBySlug: jest.fn(),
  };
  const jwtService = {
    sign: jest.fn().mockReturnValue('signed-jwt'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: userService },
        { provide: OWNERS_LOGIN, useValue: ownersLogin },
        { provide: BUILDING_LOOKUP, useValue: buildingLookup },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  it('login plataforma: superadmin con contraseña válida', async () => {
    userService.findSuperAdminByUsuario.mockResolvedValue({
      _id: userId,
      usuario: 'root',
      passwordHash: 'hash',
      isSuperAdmin: true,
    });
    userService.validatePassword.mockResolvedValue(true);

    const result = await service.login('root', 'secret');

    expect(result.access_token).toBe('signed-jwt');
    expect(result.rol).toBe('superadmin');
    expect(jwtService.sign).toHaveBeenCalled();
  });

  it('login plataforma: usuario inexistente → 401', async () => {
    userService.findSuperAdminByUsuario.mockResolvedValue(null);

    await expect(service.login('nada', 'x')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('login edificio: admin tenant con contraseña inválida → 401', async () => {
    buildingLookup.findBySlug.mockResolvedValue({
      _id: buildingId,
      nombre: 'Torre',
      slug: 'torre',
    });
    userService.findAdminByUsuarioAndBuilding.mockResolvedValue({
      _id: userId,
      usuario: 'admin',
      passwordHash: 'hash',
      buildingId,
    });
    userService.validatePassword.mockResolvedValue(false);

    await expect(service.login('admin', 'bad', 'torre')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('login edificio: admin tenant exitoso', async () => {
    buildingLookup.findBySlug.mockResolvedValue({
      _id: buildingId,
      nombre: 'Torre',
      slug: 'torre',
    });
    userService.findAdminByUsuarioAndBuilding.mockResolvedValue({
      _id: userId,
      usuario: 'admin',
      passwordHash: 'hash',
      buildingId,
      isSuperAdmin: false,
    });
    userService.validatePassword.mockResolvedValue(true);

    const result = await service.login('admin', 'ok', 'torre');

    expect(result.rol).toBe('admin');
    expect(result.edificio).toBe('Torre');
    expect(result.buildingId).toBe(buildingId.toString());
  });

  it('login edificio: propietario activo', async () => {
    buildingLookup.findBySlug.mockResolvedValue({
      _id: buildingId,
      nombre: 'Torre',
      slug: 'torre',
    });
    userService.findAdminByUsuarioAndBuilding.mockResolvedValue(null);
    const ownerId = new Types.ObjectId();
    ownersLogin.findActiveByEmail.mockResolvedValue({
      _id: ownerId,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuv', // bcrypt mock below
      rol: 'propietario',
      piso: 3,
      apartamento: 12,
      idUnico: '3-12',
    });
    jest.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const result = await service.login('owner@test.com', 'ok', 'torre');

    expect(result.rol).toBe('propietario');
    expect(result.piso).toBe(3);
    expect(result.idUnico).toBe('3-12');
  });

  it('login edificio: sin admin ni propietario → 401', async () => {
    buildingLookup.findBySlug.mockResolvedValue({
      _id: buildingId,
      nombre: 'Torre',
      slug: 'torre',
    });
    userService.findAdminByUsuarioAndBuilding.mockResolvedValue(null);
    ownersLogin.findActiveByEmail.mockResolvedValue(null);

    await expect(service.login('ghost', 'x', 'torre')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
