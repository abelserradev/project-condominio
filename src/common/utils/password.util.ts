import { BadRequestException } from '@nestjs/common';

/**
 * Valida la fortaleza de una contraseña
 * Requiere: mínimo 8 caracteres, al menos una mayúscula, una minúscula y un número
 */
export function validatePasswordStrength(password: string): void {
  if (!password || password.length < 8) {
    throw new BadRequestException(
      'La contraseña debe tener al menos 8 caracteres',
    );
  }
  if (!/[a-z]/.test(password)) {
    throw new BadRequestException(
      'La contraseña debe contener al menos una letra minúscula',
    );
  }
  if (!/[A-Z]/.test(password)) {
    throw new BadRequestException(
      'La contraseña debe contener al menos una letra mayúscula',
    );
  }
  if (!/[0-9]/.test(password)) {
    throw new BadRequestException(
      'La contraseña debe contener al menos un número',
    );
  }
}
