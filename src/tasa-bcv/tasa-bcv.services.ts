import { Injectable } from '@nestjs/common';

const DOLAR_OFICIAL_URL = 'https://ve.dolarapi.com/v1/dolares/oficial';

export interface TasaBcvResponse {
  fuente: string;
  nombre: string;
  compra: number | null;
  venta: number | null;
  promedio: number;
  fechaactualizacion: string;
}

@Injectable()
export class TasaBcvService {
  async getTasa(): Promise<{ promedio: number; fechaActualizacion?: string }> {
    const res = await fetch(DOLAR_OFICIAL_URL);
    if (!res.ok) throw new Error('Error al obtener tasa BCV');
    const data = (await res.json()) as TasaBcvResponse;
    return {
      promedio: data.promedio,
      fechaActualizacion: data.fechaactualizacion,
    };
  }
}
