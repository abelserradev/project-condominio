import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Delete,
    Param,
    UseGuards,
    NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AvisosService } from './avisos.service';
import { CreateAvisoDto } from './dto/create-aviso.dto';
import { UpdateAvisoDto } from './dto/update-aviso.dto';

function mapDocToResponse(doc: { _id: { toString(): string }; titulo: string; mensaje: string; tipo: string; prioridad?: string; estado?: string } & { createdAt?: Date }) {
    const createdAt = doc.createdAt;
    return {
        _id: doc._id.toString(),
        titulo: doc.titulo,
        mensaje: doc.mensaje,
        tipo: doc.tipo,
        prioridad: doc.prioridad ?? 'media',
        estado: doc.estado ?? 'borrador',
        createdAt: createdAt instanceof Date ? createdAt.toISOString() : createdAt,
    };
}

@Controller('avisos')
export class AvisosController {
    constructor(private readonly avisosService: AvisosService) {}

    @Get()
    async findAll() {
        const list = await this.avisosService.findAll();
        return list.map((item) => mapDocToResponse(item as Parameters<typeof mapDocToResponse>[0]));
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        const doc = await this.avisosService.findOne(id);
        if (!doc) throw new NotFoundException('Aviso no encontrado');
        return mapDocToResponse(doc as Parameters<typeof mapDocToResponse>[0]);
    }

    @Post()
    @UseGuards(JwtAuthGuard)
    async create(@Body() dto: CreateAvisoDto) {
        const doc = await this.avisosService.create(dto);
        return mapDocToResponse(doc as Parameters<typeof mapDocToResponse>[0]);
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard)
    async update(@Param('id') id: string, @Body() dto: UpdateAvisoDto) {
        const doc = await this.avisosService.update(id, dto);
        if (!doc) throw new NotFoundException('Aviso no encontrado');
        return mapDocToResponse(doc as Parameters<typeof mapDocToResponse>[0]);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard)
    async remove(@Param('id') id: string) {
        await this.avisosService.remove(id);
        return { ok: true };
    }
}