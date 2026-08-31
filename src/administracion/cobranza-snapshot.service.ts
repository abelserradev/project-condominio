import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CacheService } from '../common/cache.service';
import {
  CobranzaSnapshot,
  CobranzaSnapshotDocument,
} from './schemas/cobranza-snapshot.schema';
import {
  CobranzaReportService,
  type ReporteCobranza,
} from './cobranza-report.service';

const CACHE_TTL_MS = 5 * 60 * 1000;

const cacheKey = (buildingId: Types.ObjectId): string =>
  `reporte:cobranza:${buildingId.toString()}`;

export type FuenteReporte = 'snapshot' | 'cache' | 'rebuild';

export interface ReporteCobranzaConFuente extends ReporteCobranza {
  actualizadoEn: string;
  fuente: FuenteReporte;
}

/**
 * Read model del reporte de cobranza (delta 2026-08-cobranza-read-model).
 * El rebuild es completo por edificio — suficiente para el volumen actual;
 * incremental por apartamento queda como optimización futura si hace falta.
 */
@Injectable()
export class CobranzaSnapshotService {
  private readonly logger = new Logger(CobranzaSnapshotService.name);
  private readonly rebuildsEnCurso = new Set<string>();

  constructor(
    @InjectModel(CobranzaSnapshot.name)
    private readonly snapshotModel: Model<CobranzaSnapshotDocument>,
    private readonly cobranzaReportService: CobranzaReportService,
    private readonly cacheService: CacheService,
  ) {}

  async rebuild(buildingId: Types.ObjectId): Promise<void> {
    const clave = buildingId.toString();
    // Evita rebuilds duplicados en el mismo proceso si llegan eventos en ráfaga.
    if (this.rebuildsEnCurso.has(clave)) return;
    this.rebuildsEnCurso.add(clave);
    try {
      const reporte = await this.cobranzaReportService.build(buildingId);
      await this.snapshotModel
        .findOneAndUpdate(
          { buildingId },
          {
            $set: {
              actualizadoEn: new Date(),
              resumen: reporte.resumen,
              filas: reporte.filas,
            },
            $inc: { version: 1 },
          },
          { upsert: true, new: true },
        )
        .exec();
      await this.cacheService.delete(cacheKey(buildingId));
    } catch (err) {
      // El snapshot queda stale; la próxima lectura con fallback lo reintenta.
      this.logger.warn(`Rebuild cobranza falló para ${clave}: ${String(err)}`);
    } finally {
      this.rebuildsEnCurso.delete(clave);
    }
  }

  /** Encola rebuild sin bloquear la request de escritura (REQ-011). */
  programarRebuild(buildingId: Types.ObjectId): void {
    setImmediate(() => {
      void this.rebuild(buildingId);
    });
  }

  async obtenerReporte(
    buildingId: Types.ObjectId,
  ): Promise<ReporteCobranzaConFuente> {
    const key = cacheKey(buildingId);
    const cached = await this.cacheService.get<ReporteCobranzaConFuente>(key);
    if (cached) {
      return { ...cached, fuente: 'cache' };
    }

    const snapshot = await this.snapshotModel
      .findOne({ buildingId })
      .lean()
      .exec();

    if (snapshot) {
      const reporte = this.mapearSnapshot(snapshot, 'snapshot');
      await this.cacheService.set(key, reporte, CACHE_TTL_MS);
      return reporte;
    }

    // Cold start (REQ-015): primera lectura del edificio sin snapshot.
    const reporte = await this.cobranzaReportService.build(buildingId);
    await this.snapshotModel
      .findOneAndUpdate(
        { buildingId },
        {
          $set: {
            actualizadoEn: new Date(),
            resumen: reporte.resumen,
            filas: reporte.filas,
          },
          $inc: { version: 1 },
        },
        { upsert: true },
      )
      .exec();
    const conFuente = this.mapearReporte(reporte, 'rebuild');
    await this.cacheService.set(key, conFuente, CACHE_TTL_MS);
    return conFuente;
  }

  private mapearSnapshot(
    snapshot: CobranzaSnapshot,
    fuente: FuenteReporte,
  ): ReporteCobranzaConFuente {
    const actualizadoEn = snapshot.actualizadoEn.toISOString();
    return {
      generadoEn: actualizadoEn,
      actualizadoEn,
      fuente,
      resumen: snapshot.resumen,
      filas: snapshot.filas as unknown as ReporteCobranza['filas'],
    };
  }

  private mapearReporte(
    reporte: ReporteCobranza,
    fuente: FuenteReporte,
  ): ReporteCobranzaConFuente {
    return {
      ...reporte,
      actualizadoEn: reporte.generadoEn,
      fuente,
    };
  }
}
