import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateBuildingDto {
  @IsString()
  @MinLength(3)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'El slug solo puede contener minúsculas, números y guiones',
  })
  slug: string;

  @IsString()
  @MinLength(3)
  nombre: string;

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsInt()
  @Min(1)
  @Max(50)
  totalPisos: number;

  @IsInt()
  @Min(1)
  @Max(20)
  apartamentosPorPiso: number;

  @IsString()
  @MinLength(3)
  adminUsuario: string;

  @IsString()
  @MinLength(6)
  adminPassword: string;

  @IsOptional()
  @IsString()
  datosContactoPago?: string;
}
