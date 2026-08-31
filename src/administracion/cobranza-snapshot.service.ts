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
const LOCK_TTL_SEC = 120;

const cacheKey = (buildingId: Types.ObjectId): string =>
  `reporte:cobranza:${buildingId.toString()}`;

const lockKey = (buildingId: Types.ObjectId): string =>
  `snapshot:lock:${buildingId.toString()}`;

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

  constructor(
    @InjectModel(CobranzaSnapshot.name)
    private readonly snapshotModel: Model<CobranzaSnapshotDocument>,
    private readonly cobranzaReportService: CobranzaReportService,
    private readonly cacheService: CacheService,
  ) {}

  async rebuild(buildingId: Types.ObjectId): Promise<void> {
    const claveLock = lockKey(buildingId);
    const adquirio = await this.cacheService.acquireLock(
      claveLock,
      LOCK_TTL_SEC,
    );
    if (!adquirio) {
      this.logger.debug(
        `Rebuild omitido: lock activo para ${buildingId.toString()}`,
      );
      return;
    }
    try {
      await this.persistirRebuild(buildingId);
    } catch (err) {
      this.logger.warn(
        `Rebuild cobranza falló para ${buildingId.toString()}: ${String(err)}`,
      );
    } finally {
      await this.cacheService.releaseLock(claveLock);
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

    // Cold start (REQ-015): lock evita dos rebuilds concurrentes en multi-instancia.
    const claveLock = lockKey(buildingId);
    const adquirio = await this.cacheService.acquireLock(
      claveLock,
      LOCK_TTL_SEC,
    );
    if (!adquirio) {
      const esperado = await this.esperarSnapshot(buildingId);
      if (esperado) {
        const reporte = this.mapearSnapshot(esperado, 'snapshot');
        await this.cacheService.set(key, reporte, CACHE_TTL_MS);
        return reporte;
      }
    }

    try {
      const recheck = await this.snapshotModel
        .findOne({ buildingId })
        .lean()
        .exec();
      if (recheck) {
        const reporte = this.mapearSnapshot(recheck, 'snapshot');
        await this.cacheService.set(key, reporte, CACHE_TTL_MS);
        return reporte;
      }

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
    } finally {
      if (adquirio) {
        await this.cacheService.releaseLock(claveLock);
      }
    }
  }

  private async persistirRebuild(buildingId: Types.ObjectId): Promise<void> {
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
  }

  /** Poll breve mientras otro worker termina el cold start. */
  private async esperarSnapshot(
    buildingId: Types.ObjectId,
    intentos = 8,
    delayMs = 400,
  ): Promise<CobranzaSnapshot | null> {
    for (let i = 0; i < intentos; i++) {
      await new Promise((r) => setTimeout(r, delayMs));
      const doc = await this.snapshotModel
        .findOne({ buildingId })
        .lean()
        .exec();
      if (doc) return doc;
    }
    return null;
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
