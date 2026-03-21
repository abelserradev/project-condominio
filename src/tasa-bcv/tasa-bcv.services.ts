import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CacheService } from '../common/cache.service';

const DOLAR_OFICIAL_URL = 'https://ve.dolarapi.com/v1/dolares/oficial';
const DOLAR_HISTORICOS_URL = 'https://ve.dolarapi.com/v1/historicos/dolares/oficial';
const TTL_MS = 26 * 60 * 60 * 1000; // 26h - cubre el día completo Venezuela
const TTL_HISTORICO_MS = 7 * 24 * 60 * 60 * 1000; // 7 días - datos históricos no cambian

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export interface TasaBcvHistoricoItem {
  fuente: string;
  compra: number | null;
  venta: number | null;
  promedio: number;
  fecha: string;
}

export interface TasaBcvResponse {
  fuente: string;
  nombre: string;
  compra: number | null;
  venta: number | null;
  promedio: number;
  fechaactualizacion: string;
}

export type TasaBcvResult = { promedio: number; fechaActualizacion?: string };

function getVenezuelaDateString(): string {
  const now = new Date();
  const venezuela = new Date(now.getTime() + (now.getTimezoneOffset() - 240) * 60 * 1000);
  return venezuela.toISOString().slice(0, 10);
}

@Injectable()
export class TasaBcvService {
  private pendingPromises = new Map<string, Promise<TasaBcvResult>>();

  constructor(private readonly cacheService: CacheService) {}

  async getTasa(): Promise<TasaBcvResult> {
    const key = `tasa-bcv:${getVenezuelaDateString()}`;

    const cached = await this.cacheService.get<TasaBcvResult>(key);
    if (cached) return cached;

    const pending = this.pendingPromises.get(key);
    if (pending) return pending;

    const fetchPromise = this.fetchTasaFromApi()
      .then(async (result) => {
        await this.cacheService.set(key, result, TTL_MS);
        this.pendingPromises.delete(key);
        return result;
      })
      .catch((err) => {
        this.pendingPromises.delete(key);
        throw err;
      });

    this.pendingPromises.set(key, fetchPromise);
    return fetchPromise;
  }

  private async fetchTasaFromApi(): Promise<TasaBcvResult> {
    const res = await fetch(DOLAR_OFICIAL_URL);
    if (!res.ok) throw new Error('Error al obtener tasa BCV');
    const data = (await res.json()) as TasaBcvResponse;
    return {
      promedio: data.promedio,
      fechaActualizacion: data.fechaactualizacion,
    };
  }

  /**
   * Obtiene la tasa BCV del día indicado usando el histórico de DolarAPI.
   * Útil cuando el OCR extrae la fecha del comprobante y se debe calcular con la tasa de ese día.
   */
  async getTasaPorFecha(fecha: string): Promise<TasaBcvResult> {
    if (!FECHA_REGEX.test(fecha)) {
      throw new BadRequestException('Formato de fecha inválido. Use YYYY-MM-DD');
    }

    const key = `tasa-bcv:fecha:${fecha}`;
    const cached = await this.cacheService.get<TasaBcvResult>(key);
    if (cached) return cached;

    const pending = this.pendingPromises.get(key);
    if (pending) return pending;

    const fetchPromise = this.fetchTasaHistoricoPorFecha(fecha)
      .then(async (result) => {
        await this.cacheService.set(key, result, TTL_HISTORICO_MS);
        this.pendingPromises.delete(key);
        return result;
      })
      .catch((err) => {
        this.pendingPromises.delete(key);
        throw err;
      });

    this.pendingPromises.set(key, fetchPromise);
    return fetchPromise;
  }

  private async fetchTasaHistoricoPorFecha(fecha: string): Promise<TasaBcvResult> {
    const res = await fetch(DOLAR_HISTORICOS_URL);
    if (!res.ok) throw new Error('Error al obtener histórico de tasa BCV');
    const data = (await res.json()) as TasaBcvHistoricoItem[];
    const entrada = data.find((e) => e.fecha === fecha);
    if (!entrada) {
      throw new NotFoundException(`No hay tasa BCV registrada para la fecha ${fecha}`);
    }
    return {
      promedio: entrada.promedio,
      fechaActualizacion: entrada.fecha,
    };
  }
}
