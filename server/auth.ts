import crypto from 'node:crypto';

const KEY_LEN = 64;

/** `scrypt$<salt>$<hash>`, both base64url. */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, KEY_LEN);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = crypto.scryptSync(password, Buffer.from(salt, 'base64url'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

/** Random URL-safe id; 9 bytes gives 12 characters. */
export function randomId(bytes = 9): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('base64url');
}

/** Tiny fixed-window counter keyed by e.g. client IP, for throttling failed logins. */
export function createLimiter(max: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return {
    blocked(key: string): boolean {
      const h = hits.get(key);
      return !!h && h.resetAt > Date.now() && h.count >= max;
    },
    hit(key: string): void {
      const now = Date.now();
      const h = hits.get(key);
      if (!h || h.resetAt <= now) hits.set(key, { count: 1, resetAt: now + windowMs });
      else h.count++;
    },
  };
}
