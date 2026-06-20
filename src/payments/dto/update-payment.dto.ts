import { IsIn, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdatePaymentDto {
  @IsOptional()
  @IsIn(['pendiente', 'aceptado', 'pagado', 'rechazado'], {
    message: 'Estado inválido',
  })
  estado?: string;

  @IsOptional()
  @IsNumber({}, { message: 'El monto en Bs debe ser un número' })
  @Min(0, { message: 'El monto en Bs no puede ser negativo' })
  montoBs?: number;

  @IsOptional()
  @IsNumber({}, { message: 'La tasa BCV debe ser un número' })
  @Min(0, { message: 'La tasa BCV no puede ser negativa' })
  tasaBcv?: number;
}
