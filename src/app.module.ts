import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { BuildingsModule } from './buildings/buildings.module';
import { ApartmentsModule } from './apartments/apartments.module';
import { BanksModule } from './banks/banks.module';
import { PaymentsModule } from './payments/payments.module';
import { OwnersModule } from './owners/owners.module';
import { FilesModule } from './files/files.module';
import { tasabcvmodule } from './tasa-bcv/tasa-bcv.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
const mongoUri =
  process.env.MONGODB_URI ?? 'mongodb://localhost:27017/condominio';

@Module({
  imports: [
    MongooseModule.forRoot(mongoUri),
    CommonModule,
    BuildingsModule,
    ApartmentsModule,
    BanksModule,
    PaymentsModule,
    OwnersModule,
    FilesModule,
    tasabcvmodule,
    UserModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
