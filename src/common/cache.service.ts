import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const PREFIX = 'condominio:';
const TTL_AVISOS_READ_MS = 365 * 24 * 60 * 60 * 1000; // 1 año para "última lectura"

/**
 * Caché con soporte Redis. Si REDIS_URL está definido, usa Redis; si no, fallback en memoria.
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private redis: Redis | null = null;
  private memoryCache = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTtl = 5 * 60 * 1000;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => Math.min(times * 100, 3000),
        lazyConnect: true,
      });
      this.redis.connect().catch((err) => {
        console.warn('Redis connection failed, using memory cache:', err.message);
        this.redis = null;
      });
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  private key(k: string): string {
    return PREFIX + k;
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.redis) {
      try {
        const raw = await this.redis.get(this.key(key));
        if (!raw) return null;
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    }
    const entry = this.memoryCache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.memoryCache.delete(key);
      return null;
    }
    return entry.data;
  }

  async set<T>(key: string, data: T, ttlMs?: number): Promise<void> {
    const ttl = ttlMs ?? this.defaultTtl;
    if (this.redis) {
      try {
        const serialized = JSON.stringify(data);
        await this.redis.setex(this.key(key), Math.ceil(ttl / 1000), serialized);
      } catch {
        // fallback silencioso
      }
      return;
    }
    this.memoryCache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    });
  }

  async delete(key: string): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.del(this.key(key));
      } catch {
        //
      }
      return;
    }
    this.memoryCache.delete(key);
  }

  async deletePattern(pattern: string): Promise<void> {
    if (this.redis) {
      try {
        // Convertir regex "prefix:.*" a patrón Redis "condominio:prefix:*"
        const redisPattern = this.key(pattern.replace(/\.\*/g, '*'));
        const keys = await this.redis.keys(redisPattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } catch {
        //
      }
      return;
    }
    const regexPattern = pattern.startsWith('^') ? pattern : `^${pattern}`;
    const regex = new RegExp(regexPattern.replace(/\.\*/g, '.*'));
    const toDelete: string[] = [];
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) toDelete.push(key);
    }
    toDelete.forEach((k) => this.memoryCache.delete(k));
  }

  async clear(): Promise<void> {
    if (this.redis) {
      try {
        const keys = await this.redis.keys(`${PREFIX}*`);
        if (keys.length > 0) await this.redis.del(...keys);
      } catch {
        //
      }
      return;
    }
    this.memoryCache.clear();
  }

  generateKey(prefix: string, params: Record<string, unknown>): string {
    const sorted = Object.keys(params)
      .sort()
      .map((k) => `${k}:${params[k]}`)
      .join('|');
    return `${prefix}:${sorted}`;
  }

  /** Clave y TTL para "última lectura de avisos" por dispositivo */
  getAvisosReadKey(deviceId: string): string {
    return `avisos:read:${deviceId}`;
  }

  async getAvisosLastRead(deviceId: string): Promise<number | null> {
    const raw = await this.get<string>(this.getAvisosReadKey(deviceId));
    if (raw == null) return null;
    const n = Number(raw);
    return isNaN(n) ? null : n;
  }

  async setAvisosLastRead(deviceId: string): Promise<void> {
    await this.set(
      this.getAvisosReadKey(deviceId),
      String(Date.now()),
      TTL_AVISOS_READ_MS,
    );
  }
}
