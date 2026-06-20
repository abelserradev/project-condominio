import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  contraseñaActual: string;

  @IsString()
  @MinLength(8)
  contraseñaNueva: string;
}
