import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Building, BuildingDocument } from '../entities/building.schema';
import type {
  BuildingLoginSnapshot,
  BuildingLookupPort,
} from './building-lookup.port';

@Injectable()
export class BuildingLookupService implements BuildingLookupPort {
  constructor(
    @InjectModel(Building.name)
    private readonly buildingModel: Model<BuildingDocument>,
  ) {}

  async findBySlug(slug: string): Promise<BuildingLoginSnapshot | null> {
    const doc = await this.buildingModel
      .findOne({ slug: slug.toLowerCase().trim() })
      .select('_id nombre slug')
      .lean()
      .exec();
    if (!doc?._id) {
      return null;
    }
    return {
      _id: doc._id,
      nombre: String(doc.nombre),
      slug: String(doc.slug),
    };
  }
}
