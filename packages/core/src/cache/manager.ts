import type { CacheConfig, CacheEntry } from '../types.js';
import { createHash } from 'crypto';
import type { ImageIntent } from '../types.js';

export class CacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private config: CacheConfig;

  constructor(config: CacheConfig) {
    this.config = config;
  }

  /**
   * Generate cache key from intent
   */
  static generateKey(intent: ImageIntent): string {
    const keyData = {
      type: intent.type,
      subject: intent.subject,
      style: intent.style,
      quality: intent.quality,
      dimensions: intent.dimensions,
    };

    return createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex');
  }

  /**
   * Get cache entry by key
   */
  async get(key: string): Promise<CacheEntry | null> {
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Update hit count
    entry.metadata.hitCount++;

    return entry;
  }

  /**
   * Set cache entry
   */
  async set(
    key: string,
    url: string,
    metadata: Omit<CacheEntry['metadata'], 'hitCount'>
  ): Promise<void> {
    // Check cache size limit
    if (this.cache.size >= this.config.maxEntries) {
      this.evictLRU();
    }

    const entry: CacheEntry = {
      key,
      url,
      metadata: {
        ...metadata,
        hitCount: 1,
      },
      createdAt: Date.now(),
      expiresAt: Date.now() + (this.config.ttl.url * 1000),
    };

    this.cache.set(key, entry);
  }

  /**
   * Delete cache entry
   */
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  getStats(): {
    size: number;
    maxEntries: number;
    hitRate: number;
  } {
    let totalHits = 0;
    for (const entry of this.cache.values()) {
      totalHits += entry.metadata.hitCount;
    }

    return {
      size: this.cache.size,
      maxEntries: this.config.maxEntries,
      hitRate: this.cache.size > 0 ? totalHits / this.cache.size : 0,
    };
  }

  /**
   * Evict least recently used entries
   */
  private evictLRU(): void {
    let oldest: CacheEntry | null = null;
    let oldestKey = '';

    for (const [key, entry] of this.cache.entries()) {
      if (!oldest || entry.createdAt < oldest.createdAt) {
        oldest = entry;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}
