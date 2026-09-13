import { CacheService } from '../common/cache.service';

export async function invalidarCacheListadosRecibos(
  cacheService: CacheService,
): Promise<void> {
  await cacheService.deletePattern(`recibos:.*`);
  await cacheService.deletePattern(`recibos_pendientes_saldo:.*`);
}
