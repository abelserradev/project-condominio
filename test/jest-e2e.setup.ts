// E2E no levanta Redis; evita consumer BullMQ y conexión ioredis en CacheService.
process.env.DISABLE_BULLMQ_WORKERS = 'true';
delete process.env.REDIS_URL;
