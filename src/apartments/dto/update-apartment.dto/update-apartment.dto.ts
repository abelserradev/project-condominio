import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateApartmentDto {
  @IsOptional()
  @IsInt({ message: 'El piso debe ser un número entero' })
  @Min(1, { message: 'El piso debe ser mayor a 0' })
  @Max(99, { message: 'El piso no puede superar 99' })
  piso?: number;

  @IsOptional()
  @IsInt({ message: 'El número de apartamento debe ser un número entero' })
  @Min(1, { message: 'El apartamento debe ser mayor a 0' })
  @Max(99, { message: 'El apartamento no puede superar 99' })
  numero?: number;

  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'El idUnico debe tener al menos 3 caracteres' })
  @MaxLength(20, { message: 'El idUnico no puede superar los 20 caracteres' })
  idUnico?: string;
}
