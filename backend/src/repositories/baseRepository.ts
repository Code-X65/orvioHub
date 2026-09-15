import { anyApi } from 'convex/server';
import { ConvexHttpClient } from 'convex/browser';
import { env } from '../config/env.js';

export function serviceError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    message.match(/Uncaught Error:\s*([A-Z][A-Z0-9_]+)/)?.[1] ||
    message.match(/\b([A-Z][A-Z0-9_]{3,})\b/)?.[1];
  const wrapped: Error & { code?: string } = new Error(message);
  if (code) wrapped.code = code;
  throw wrapped;
}

export class BaseRepository {
  protected readonly client: ConvexHttpClient;

  constructor(client?: ConvexHttpClient) {
    if (client) {
      this.client = client;
    } else {
      const url = env?.CONVEX_URL || 'https://ceaseless-bloodhound-791.convex.cloud';
      this.client = new ConvexHttpClient(url);
    }
  }

  public async query<T = any>(path: string, args: Record<string, unknown> = {}): Promise<T> {
    try {
      const [module, functionName] = path.split(':');
      return (await this.client.query((anyApi as any)[module][functionName], args)) as T;
    } catch (error) {
      serviceError(error);
    }
  }

  public async mutate<T = any>(path: string, args: Record<string, unknown> = {}): Promise<T> {
    try {
      const [module, functionName] = path.split(':');
      return (await this.client.mutation((anyApi as any)[module][functionName], args)) as T;
    } catch (error) {
      serviceError(error);
    }
  }
}
