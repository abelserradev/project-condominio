import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const reflector = new Reflector();
  const guard = new JwtAuthGuard(reflector);
  const context = {} as ExecutionContext;

  it('canActivate traduce fallo async a UnauthorizedException', async () => {
    const parentProto = Object.getPrototypeOf(JwtAuthGuard.prototype) as {
      canActivate: (ctx: ExecutionContext) => Promise<boolean>;
    };
    const spy = jest
      .spyOn(parentProto, 'canActivate')
      .mockRejectedValue(new Error('expired'));

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      /inválido o expirado/i,
    );

    spy.mockRestore();
  });

  it('handleRequest rechaza sesión sin usuario', () => {
    const ejecutar = (): void => {
      guard.handleRequest(undefined, undefined, undefined, context);
    };
    expect(ejecutar).toThrow(UnauthorizedException);
  });
});
