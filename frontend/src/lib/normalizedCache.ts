/**
 * Orviohub Normalized Entity Cache
 * Deduplicates and shares entities (workspaces, organizations, branches, products, users)
 * across independent API query responses to eliminate redundant fetching and stale UI states.
 */

export type EntityType =
  | 'workspaces'
  | 'organizations'
  | 'branches'
  | 'products'
  | 'users'
  | 'memberships'
  | string;

export type EntitySubscriber<T = any> = (entity: T | undefined) => void;

class NormalizedEntityCache {
  private entities = new Map<string, any>();
  private subscribers = new Map<string, Set<EntitySubscriber>>();
  private typeSubscribers = new Map<string, Set<() => void>>();

  private toKey(type: EntityType, id: string): string {
    return `${type}:${id}`;
  }

  public getEntity<T = any>(type: EntityType, id: string): T | undefined {
    return this.entities.get(this.toKey(type, id));
  }

  public getAll<T = any>(type: EntityType): T[] {
    const prefix = `${type}:`;
    const results: T[] = [];
    for (const [key, value] of this.entities.entries()) {
      if (key.startsWith(prefix)) {
        results.push(value);
      }
    }
    return results;
  }

  public setEntity<T extends Record<string, any>>(type: EntityType, id: string, data: T): void {
    if (!id) return;
    const key = this.toKey(type, id);
    const existing = this.entities.get(key) || {};
    const merged = { ...existing, ...data };
    this.entities.set(key, merged);

    // Notify key-specific subscribers
    const listeners = this.subscribers.get(key);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(merged);
        } catch {}
      }
    }

    // Notify type subscribers
    const typeListeners = this.typeSubscribers.get(type);
    if (typeListeners) {
      for (const listener of typeListeners) {
        try {
          listener();
        } catch {}
      }
    }
  }

  public removeEntity(type: EntityType, id: string): void {
    const key = this.toKey(type, id);
    if (this.entities.has(key)) {
      this.entities.delete(key);

      const listeners = this.subscribers.get(key);
      if (listeners) {
        for (const listener of listeners) {
          try {
            listener(undefined);
          } catch {}
        }
      }

      const typeListeners = this.typeSubscribers.get(type);
      if (typeListeners) {
        for (const listener of typeListeners) {
          try {
            listener();
          } catch {}
        }
      }
    }
  }

  /**
   * Intelligently scans an API response object/array and extracts known entities into normalized storage.
   */
  public normalize(data: any): any {
    if (!data || typeof data !== 'object') return data;

    if (Array.isArray(data)) {
      for (const item of data) {
        this.normalize(item);
      }
      return data;
    }

    // Direct entity objects
    if (data.workspaces && Array.isArray(data.workspaces)) {
      for (const ws of data.workspaces) {
        const id = ws.id || ws._id;
        if (id) this.setEntity('workspaces', id, ws);
      }
    } else if (data.workspace && typeof data.workspace === 'object') {
      const id = data.workspace.id || data.workspace._id;
      if (id) this.setEntity('workspaces', id, data.workspace);
    }

    if (data.organizations && Array.isArray(data.organizations)) {
      for (const org of data.organizations) {
        const id = org.id || org._id;
        if (id) this.setEntity('organizations', id, org);
      }
    } else if (data.organization && typeof data.organization === 'object') {
      const id = data.organization.id || data.organization._id;
      if (id) this.setEntity('organizations', id, data.organization);
    }

    if (data.branches && Array.isArray(data.branches)) {
      for (const br of data.branches) {
        const id = br.id || br._id;
        if (id) this.setEntity('branches', id, br);
      }
    } else if (data.branch && typeof data.branch === 'object') {
      const id = data.branch.id || data.branch._id;
      if (id) this.setEntity('branches', id, data.branch);
    }

    if (data.products && Array.isArray(data.products)) {
      for (const prod of data.products) {
        const id = prod.id || prod._id || prod.key;
        if (id) this.setEntity('products', id, prod);
      }
    }

    if (data.user && typeof data.user === 'object') {
      const id = data.user.id || data.user._id;
      if (id) this.setEntity('users', id, data.user);
    }

    return data;
  }

  public subscribe<T = any>(type: EntityType, id: string, callback: EntitySubscriber<T>): () => void {
    const key = this.toKey(type, id);
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(callback);

    return () => {
      this.subscribers.get(key)?.delete(callback);
    };
  }

  public subscribeType(type: EntityType, callback: () => void): () => void {
    if (!this.typeSubscribers.has(type)) {
      this.typeSubscribers.set(type, new Set());
    }
    this.typeSubscribers.get(type)!.add(callback);

    return () => {
      this.typeSubscribers.get(type)?.delete(callback);
    };
  }

  public clear(): void {
    this.entities.clear();
    this.subscribers.clear();
    this.typeSubscribers.clear();
  }
}

export const normalizedCache = new NormalizedEntityCache();
