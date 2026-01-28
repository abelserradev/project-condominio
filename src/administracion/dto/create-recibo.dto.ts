import { IsNotEmpty, IsNumber, IsArray, IsString, Min, Max, ArrayMinSize, IsInt, IsDateString } from 'class-validator';

export class CreateReciboDto {
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

  @IsNotEmpty({ message: 'El monto en USD es requerido' })
  @IsNumber({}, { message: 'El monto en USD debe ser un número' })
  @Min(0.01, { message: 'El monto debe ser mayor a 0' })
  montoUsd: number;

  @IsNotEmpty({ message: 'El tipo de deuda es requerido' })
  @IsString({ message: 'El tipo de deuda debe ser una cadena de texto' })
  tipoDeuda: string;

  @IsNotEmpty({ message: 'La fecha reportada es requerida' })
  @IsDateString({}, { message: 'La fecha reportada debe ser una fecha válida' })
  fechaReportada: string;
}
