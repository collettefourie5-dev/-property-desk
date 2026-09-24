import { RateLimitedError } from '@/lib/errors';

/**
 * Rate limiting behind a small interface. The in-memory store is correct for the single
 * Docker VM this runs on today; if the app ever scales horizontally, add a RateLimitStore
 * backed by Redis (or similar) and swap it in `store` — call sites don't change.
 */
export interface RateLimitStore {
  /** Records a hit and returns how many hits the key has in the current window. */
  hit(key: string, windowMs: number): number;
}

class MemoryStore implements RateLimitStore {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  hit(key: string, windowMs: number): number {
    const now = Date.now();
    if (this.windows.size > 5000) {
      for (const [k, w] of this.windows) if (w.resetAt <= now) this.windows.delete(k);
    }
    const current = this.windows.get(key);
    if (!current || current.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + windowMs });
      return 1;
    }
    current.count += 1;
    return current.count;
  }
}

let store: RateLimitStore = new MemoryStore();

export function setRateLimitStore(next: RateLimitStore) {
  store = next;
}

export interface RateLimitOptions {
  /** Bucket name, e.g. "booking:start" */
  name: string;
  /** Caller identity, typically the client IP */
  identity: string;
  limit: number;
  windowMs: number;
}

/** Throws RateLimitedError (429) once `identity` exceeds `limit` hits in `windowMs`. */
export function enforceRateLimit({ name, identity, limit, windowMs }: RateLimitOptions): void {
  if (store.hit(`${name}:${identity}`, windowMs) > limit) throw new RateLimitedError();
}

/** Client IP as forwarded by the reverse proxy (Caddy/Nginx/Traefik/Cloudflare all set this). */
export function clientIp(headers: Headers): string {
  return (
    headers.get('cf-connecting-ip') ??
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headers.get('x-real-ip') ??
    'unknown'
  );
}
