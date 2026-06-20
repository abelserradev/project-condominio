import { OwnerDocument } from '../schemas/owner.schema';

export type OwnerResponse = {
  _id: string;
  nombre: string;
  email: string;
  piso: number;
  apartamento: number;
  idUnico: string;
  rol: string;
  activo: boolean;
  createdAt?: string;
};

export function mapOwnerToResponse(
  doc: OwnerDocument & { createdAt?: Date },
): OwnerResponse {
  return {
    _id: (doc._id as { toString(): string }).toString(),
    nombre: doc.nombre,
    email: doc.email,
    piso: doc.piso,
    apartamento: doc.apartamento,
    idUnico: doc.idUnico,
    rol: doc.rol,
    activo: doc.activo ?? true,
    createdAt:
      doc.createdAt instanceof Date ? doc.createdAt.toISOString() : undefined,
  };
}
