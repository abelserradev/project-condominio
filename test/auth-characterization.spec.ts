import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { CsrfGuard } from '../src/common/guards/csrf.guard';

describe('AuthController characterization', () => {
  let app: import('@nestjs/common').INestApplication<App>;
  const loginMock = jest.fn();

  beforeAll(async () => {
    process.env.DISABLE_CSRF = 'true';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: { login: loginMock },
        },
      ],
    })
      .overrideGuard(CsrfGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    loginMock.mockReset();
  });

  it('POST /auth/login sin credenciales responde 401', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({})
      .expect(401);
  });

  it('POST /auth/login con credenciales inválidas responde 401', () => {
    loginMock.mockRejectedValue(
      new UnauthorizedException('Credenciales inválidas'),
    );
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ usuario: 'admin', contraseña: 'bad' })
      .expect(401);
  });

  it('POST /auth/login exitoso devuelve access_token', async () => {
    loginMock.mockResolvedValue({
      access_token: 'jwt-test-token',
      rol: 'admin',
    });

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .set('x-platform-mode', 'true')
      .send({ usuario: 'admin', contraseña: 'ok' })
      .expect(201);

    const body = res.body as { access_token: string };
    expect(body.access_token).toBe('jwt-test-token');
    expect(loginMock).toHaveBeenCalledWith('admin', 'ok', undefined);
  });
});
