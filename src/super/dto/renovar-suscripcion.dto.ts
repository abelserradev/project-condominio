import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class RenovarSuscripcionDto {
  @IsInt()
  @Min(1)
  @Max(730)
  diasAgregados: number;

  @IsOptional()
  @IsString()
  nota?: string;
}
