import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Owner, OwnerSchema } from '../entities/owner.schema';
import { OwnersLoginService } from './owners-login.service';
import { OWNERS_LOGIN } from './owners-login.port';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Owner.name, schema: OwnerSchema }]),
  ],
  providers: [
    OwnersLoginService,
    {
      provide: OWNERS_LOGIN,
      useExisting: OwnersLoginService,
    },
  ],
  exports: [OWNERS_LOGIN, OwnersLoginService],
})
export class OwnersLoginModule {}
