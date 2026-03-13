import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { BuildingsModule } from './buildings/buildings.module';
import { ApartmentsModule } from './apartments/apartments.module';
import { BanksModule } from './banks/banks.module';
import { PaymentsModule } from './payments/payments.module';
import { AdministracionModule } from './administracion/administracion.module';
import { OwnersModule } from './owners/owners.module';
import { FilesModule } from './files/files.module';
import { TasaBcvModule } from './tasa-bcv/tasa-bcv.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { AvisosModule } from './avisos/avisos.module';
import { OcrModule } from './ocr/ocr.module';

const mongoUri =
  process.env.MONGODB_URI ?? 'mongodb://localhost:27017/condominio';

@Module({
  imports: [
    MongooseModule.forRoot(mongoUri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    CommonModule,
    BuildingsModule,
    ApartmentsModule,
    BanksModule,
    PaymentsModule,
    AdministracionModule,
    OwnersModule,
    FilesModule,
    TasaBcvModule,
    UserModule,
    AuthModule,
    AvisosModule,
    OcrModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}