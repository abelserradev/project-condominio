import { forwardRef, Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CsrfController } from './controllers/csrf.controller';
import { BuildingContextGuard } from './guards/building-context.guard';
import { SubscriptionGuard } from './guards/subscription.guard';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { BuildingsModule } from '../buildings/buildings.module';
import { UserModule } from '../user/user.module';

// Re-exportamos BuildingsModule para que cualquier módulo que importe CommonModule
// también tenga BuildingsService en su contexto DI — necesario para los guards
@Module({
  imports: [forwardRef(() => BuildingsModule), UserModule],
  controllers: [CsrfController],
  providers: [
    CacheService,
    BuildingContextGuard,
    SubscriptionGuard,
    SuperAdminGuard,
  ],
  exports: [
    CacheService,
    BuildingContextGuard,
    SubscriptionGuard,
    SuperAdminGuard,
    BuildingsModule,
  ],
})
export class CommonModule {}
