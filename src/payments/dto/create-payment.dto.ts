import {
  IsNotEmpty,
  IsNumber,
  IsArray,
  IsString,
  IsOptional,
  Min,
  Max,
  ArrayMinSize,
  IsInt,
} from 'class-validator';

export class CreatePaymentDto {
  @IsNotEmpty({ message: 'El piso es requerido' })
  @IsInt({ message: 'El piso debe ser un número entero' })
  @Min(1, { message: 'El piso debe ser mayor a 0' })
  @Max(100, { message: 'El piso no puede ser mayor a 100' })
  piso: number;

  @IsNotEmpty({ message: 'El apartamento es requerido' })
  @IsInt({ message: 'El apartamento debe ser un número entero' })
  @Min(1, { message: 'El apartamento debe ser mayor a 0' })
  @Max(100, { message: 'El apartamento no puede ser mayor a 100' })
  apartamento: number;

  @IsNotEmpty({ message: 'Los meses son requeridos' })
  @IsArray({ message: 'Los meses deben ser un array' })
  @ArrayMinSize(1, { message: 'Debe seleccionar al menos un mes' })
  @IsNumber({}, { each: true, message: 'Cada mes debe ser un número' })
  @Min(1, { each: true, message: 'Los meses deben estar entre 1 y 12' })
  @Max(12, { each: true, message: 'Los meses deben estar entre 1 y 12' })
  meses: number[];

  @IsNotEmpty({ message: 'El banco es requerido' })
  @IsString({ message: 'El banco debe ser una cadena de texto' })
  banco: string;

  @IsNotEmpty({ message: 'La fecha de pago es requerida' })
  @IsString({ message: 'La fecha de pago debe ser una cadena de texto' })
  fechaPago: string;

  @IsNotEmpty({ message: 'El número de comprobante es requerido' })
  @IsString({
    message: 'El número de comprobante debe ser una cadena de texto',
  })
  numeroComprobante: string;

  @IsNotEmpty({ message: 'El monto en USD es requerido' })
  @IsNumber({}, { message: 'El monto en USD debe ser un número' })
  @Min(0.01, { message: 'El monto debe ser mayor a 0' })
  montoUsd: number;

  @IsOptional()
  @IsNumber({}, { message: 'El monto en Bs debe ser un número' })
  @Min(0, { message: 'El monto en Bs no puede ser negativo' })
  montoBs?: number;

  @IsOptional()
  @IsNumber({}, { message: 'La tasa BCV debe ser un número' })
  @Min(0, { message: 'La tasa BCV no puede ser negativa' })
  tasaBcv?: number;
}
