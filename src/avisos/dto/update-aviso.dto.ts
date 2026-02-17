import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { Aviso_estados, Aviso_prioridades, Aviso_tipos } from "../schemas/aviso.schema";

export class UpdateAvisoDto {
    @IsOptional()
    @IsString()
    @MinLength(2, { message: 'El titulo debe tener al menos 2 caracteres' })
    @MaxLength(200, { message: 'El titulo no puede superar los 200 caracteres' })
    titulo?: string;

    @IsOptional()
    @IsString()
    @MinLength(5, { message: 'El mensaje debe tener al menos 5 caracteres' })
    @MaxLength(2000, { message: 'El mensaje no puede superar los 2000 caracteres' })
    mensaje?: string;

    @IsOptional()
    @IsIn(Aviso_tipos, { message: 'El tipo no es válido' })
    tipo?: (typeof Aviso_tipos)[number];

    @IsOptional()
    @IsIn(Aviso_prioridades, { message: 'La prioridad no es válida' })
    prioridad?: (typeof Aviso_prioridades)[number];

    @IsOptional()
    @IsIn(Aviso_estados, { message: 'El estado no es válido' })
    estado?: (typeof Aviso_estados)[number];
}
