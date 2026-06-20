import {
  IsEmail,
  IsEnum,
  IsInt,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateOwnerDto {
  @IsString()
  @MinLength(2)
  nombre: string;

  @IsEmail()
  email: string;

  @IsInt()
  @Min(1)
  piso: number;

  @IsInt()
  @Min(1)
  apartamento: number;

  @IsEnum(['propietario', 'inquilino'])
  rol: 'propietario' | 'inquilino';

  @IsString()
  @MinLength(8)
  password: string;
}
