import { Injectable } from '@nestjs/common';

const dolar_oficial_url = 'https://ve.dolarapi.com/v1/dolares/oficial';

export interface tasabcvresponse {
    fuente: string;
    nombre: string;
    compra: number | null;
    venta: number | null;
    promedio: number;
    fechaactualizacion: string;

}

@Injectable()
export class tasabcvservice {
    async getTasa(): Promise<{ promedio: number; fechaActualizacion?: string }> {
        const res = await fetch(dolar_oficial_url);
        if (!res.ok) throw new Error('Error al obtener tasa BCV');
        const data = (await res.json()) as tasabcvresponse;
        return {
          promedio: data.promedio,
          fechaActualizacion: data.fechaactualizacion,
        };
      }
}