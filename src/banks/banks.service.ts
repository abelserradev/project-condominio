import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Bank, BankDocument } from './schemas/bank.schema';
import { BANCOS_VENEZUELA } from './data/banks.seed';

@Injectable()
export class BanksService implements OnModuleInit {
  constructor(@InjectModel(Bank.name) private bankModel: Model<BankDocument>) {}

  async onModuleInit(): Promise<void> {
    const count = await this.bankModel.countDocuments();
    if (count > 0) return;
    const docs = BANCOS_VENEZUELA.map((nombre) => ({ nombre, activo: true }));
    await this.bankModel.insertMany(docs);
  }

  async findAll(): Promise<BankDocument[]> {
    return this.bankModel.find({ activo: true }).sort({ nombre: 1 }).lean();
  }
}
