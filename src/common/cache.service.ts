import { Injectable } from '@nestjs/common';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

/**
 * Caché en memoria simple para reducir carga en MongoDB.
 * Si escalamos a múltiples instancias, migrar a Redis.
 */
@Injectable()
export class CacheService {
  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTtl = 5 * 60 * 1000; // 5min - balance entre freshness y performance

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Lazy deletion - más eficiente que setInterval
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs?: number): void {
    const ttl = ttlMs ?? this.defaultTtl;
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Borra entradas por patrón regex.
   * FIXME: Con muchas keys esto puede ser lento, considerar índice inverso.
   */
  deletePattern(pattern: string): void {
    // Asegurar que el patrón coincida desde el inicio si no tiene ^
    const regexPattern = pattern.startsWith('^') ? pattern : `^${pattern}`;
    const regex = new RegExp(regexPattern);
    const toDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        toDelete.push(key);
      }
    }

    toDelete.forEach((k) => this.cache.delete(k));
  }

  clear(): void {
    this.cache.clear();
  }

  // Helper para generar keys consistentes
  generateKey(prefix: string, params: Record<string, unknown>): string {
    const sorted = Object.keys(params)
      .sort()
      .map((k) => `${k}:${params[k]}`)
      .join('|');
    
    return `${prefix}:${sorted}`;
  }

  // TODO: Agregar stats de hit/miss rate para monitoreo
  // TODO: Implementar límite de memoria (LRU eviction)
}
