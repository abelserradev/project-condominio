import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Apartment, apartmentdocument } from './schemas/apartment.schema';
import { buildApartmentsSeed } from './data/apartments.seed';

@Injectable()
export class ApartmentsService implements OnModuleInit {
  constructor(
    @InjectModel(Apartment.name) private apartmentModel: Model<apartmentdocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    const count = await this.apartmentModel.countDocuments();
    if (count > 0) return;
    const docs = buildApartmentsSeed();
    await this.apartmentModel.insertMany(docs);
  }

  async findAll(): Promise<apartmentdocument[]> {
    return this.apartmentModel.find().sort({ piso: 1, numero: 1 }).lean();
  }

  async findByPiso(piso: number): Promise<apartmentdocument[]> {
    return this.apartmentModel.find({ piso }).sort({ numero: 1 }).lean();
  }

  async findByIdUnico(idUnico: string): Promise<apartmentdocument | null> {
    return this.apartmentModel.findOne({ idUnico }).lean();
  }
}