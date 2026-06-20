import { BadRequestException } from '@nestjs/common';
import validator from 'validator';

/**
 * Valida que un estado esté en la lista de valores permitidos
 * Previene inyección NoSQL mediante operadores como $ne, $gt, etc.
 */
export function validateEstado(
  estado: string | undefined,
  allowedEstados: string[],
): string | undefined {
  if (!estado || estado.trim() === '') {
    return undefined;
  }
  const trimmedEstado = estado.trim();
  if (!allowedEstados.includes(trimmedEstado)) {
    throw new BadRequestException(
      `Estado inválido. Valores permitidos: ${allowedEstados.join(', ')}`,
    );
  }
  return trimmedEstado;
}

/**
 * Sanitiza un string eliminando caracteres peligrosos y limitando longitud
 */
export function sanitizeString(
  input: string | undefined,
  maxLength: number = 500,
): string {
  if (!input) {
    return '';
  }
  const trimmed = input.trim();
  if (trimmed.length > maxLength) {
    throw new BadRequestException(
      `El campo excede la longitud máxima de ${maxLength} caracteres`,
    );
  }
  // Escapar caracteres especiales que podrían usarse en inyección
  return validator.escape(trimmed);
}

/**
 * Valida y sanitiza un número de comprobante
 */
export function sanitizeComprobante(input: string | undefined): string {
  if (!input) {
    throw new BadRequestException('Número de comprobante requerido');
  }
  const sanitized = sanitizeString(input, 100);
  // Validar que solo contenga caracteres alfanuméricos y algunos caracteres especiales
  if (!validator.isAlphanumeric(sanitized.replace(/[-_]/g, ''))) {
    throw new BadRequestException(
      'Número de comprobante contiene caracteres inválidos',
    );
  }
  return sanitized;
}

/**
 * Valida y sanitiza un nombre de banco
 */
export function sanitizeBanco(input: string | undefined): string {
  if (!input) {
    throw new BadRequestException('Banco requerido');
  }
  const sanitized = sanitizeString(input, 100);
  // Validar que solo contenga letras, espacios y algunos caracteres especiales
  if (!validator.matches(sanitized, /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s\-.]+$/)) {
    throw new BadRequestException(
      'Nombre de banco contiene caracteres inválidos',
    );
  }
  return sanitized;
}

/**
 * Valida y sanitiza un tipo de deuda
 */
export function sanitizeTipoDeuda(input: string | undefined): string {
  if (!input) {
    throw new BadRequestException('Tipo de deuda requerido');
  }
  return sanitizeString(input, 200);
}
