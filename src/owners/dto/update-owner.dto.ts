import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateOwnerDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nombre?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  piso?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  apartamento?: number;

  @IsOptional()
  @IsEnum(['propietario', 'inquilino'])
  rol?: 'propietario' | 'inquilino';

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
