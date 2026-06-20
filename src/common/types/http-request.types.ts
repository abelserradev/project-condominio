import { Request } from 'express';
import { BuildingDocument } from '../../buildings/schemas/building.schema';

export type JwtUser = {
  sub: string;
  usuario?: string;
  rol?: string;
  isSuperAdmin?: boolean;
  buildingId?: string;
  edificio?: string;
  piso?: number;
  apartamento?: number;
  idUnico?: string;
};

export type RequestWithMutableBuilding = Request & {
  building?: BuildingDocument;
};

export type RequestWithBuilding = Request & {
  building: BuildingDocument;
};

export type RequestWithJwtUser = Request & {
  user: JwtUser;
};
