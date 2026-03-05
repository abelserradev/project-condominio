import { Injectable } from '@nestjs/common';
import { CacheService } from '../common/cache.service';

const DOLAR_OFICIAL_URL = 'https://ve.dolarapi.com/v1/dolares/oficial';
const TTL_MS = 26 * 60 * 60 * 1000; // 26h - cubre el día completo Venezuela

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

    const cached = this.cacheService.get<TasaBcvResult>(key);
    if (cached) return cached;

    const pending = this.pendingPromises.get(key);
    if (pending) return pending;

    const fetchPromise = this.fetchTasaFromApi()
      .then((result) => {
        this.cacheService.set(key, result, TTL_MS);
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
}
