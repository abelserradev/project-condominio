import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BuildingsModule } from '../buildings/buildings.module';
import { ApartmentsModule } from '../apartments/apartments.module';
import { UserModule } from '../user/user.module';
import { CommonModule } from '../common/common.module';
import { FilesModule } from '../files/files.module';
import { SuperController } from './super.controller';
import { SuperService } from './super.service';

@Module({
  imports: [
    AuthModule,
    BuildingsModule,
    ApartmentsModule,
    UserModule,
    CommonModule,
    FilesModule,
  ],
  controllers: [SuperController],
  providers: [SuperService],
})
export class SuperModule {}
