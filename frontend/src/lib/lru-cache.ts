export class LRUCache<K, V> {
  private cache = new Map<K, { value: V; expiresAt: number }>();

  constructor(
    private maxSize: number = 500,
    private defaultTtlMs: number = 300_000 // 5 minutes
  ) {}

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    // Re-insert to mark as most recently used (LRU ordering)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  set(key: K, value: V, ttlMs?: number): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs);
    this.cache.delete(key);
    this.cache.set(key, { value, expiresAt });
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  /**
   * Actively purges expired items from memory to avoid stale item accumulation.
   */
  pruneExpired(): number {
    const now = Date.now();
    let pruned = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        pruned++;
      }
    }
    return pruned;
  }

  get size(): number {
    return this.cache.size;
  }

  keys(): IterableIterator<K> {
    return this.cache.keys();
  }
}
