import { Types } from 'mongoose';

export interface BuildingLoginSnapshot {
  _id: Types.ObjectId;
  nombre: string;
  slug: string;
}

export interface BuildingLookupPort {
  findBySlug(slug: string): Promise<BuildingLoginSnapshot | null>;
}

export const BUILDING_LOOKUP = Symbol('BUILDING_LOOKUP');
