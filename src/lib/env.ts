const NODE_ENV = process.env.NODE_ENV ?? 'development';

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) {
    throw new Error(`Missing required env: ${name}`);
  }
  return v;
}

function int(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Invalid integer env ${name}=${v}`);
  }
  return n;
}

function authSecret(): string {
  const v = required('AUTH_SECRET');
  // Auth.js signs JWTs with this; <32 chars is too weak for HS256.
  if (NODE_ENV === 'production' && v.length < 32) {
    throw new Error('AUTH_SECRET must be at least 32 characters in production');
  }
  return v;
}

// Lazily resolve each entry on first access. Next.js evaluates route modules
// during `next build` page-data collection, before real env is available, so
// eager validation here would break the build. Reads still throw on the first
// runtime use, preserving the fail-fast-at-boot invariant.
type EnvShape = {
  NODE_ENV: string;
  DATABASE_URL: string;
  AUTH_SECRET: string;
  AUTH_DISCORD_ID: string;
  AUTH_DISCORD_SECRET: string;
  CARGO_BLOB_PATH: string;
  CARGO_MAX_FILE_SIZE: number;
  CARGO_USER_QUOTA: number;
  CARGO_LINK_TTL_SECONDS: number;
  CARGO_PENDING_TTL_SECONDS: number;
  CARGO_MAX_FILENAME_LEN: number;
  LOG_LEVEL: 'debug' | 'info' | 'warning' | 'error';
};

const loaders: { [K in keyof EnvShape]: () => EnvShape[K] } = {
  NODE_ENV: () => NODE_ENV,
  DATABASE_URL: () => required('DATABASE_URL'),
  AUTH_SECRET: () => authSecret(),
  AUTH_DISCORD_ID: () => required('AUTH_DISCORD_ID'),
  AUTH_DISCORD_SECRET: () => required('AUTH_DISCORD_SECRET'),
  CARGO_BLOB_PATH: () => process.env.CARGO_BLOB_PATH ?? '/var/lib/cargo/blobs',
  CARGO_MAX_FILE_SIZE: () => int('CARGO_MAX_FILE_SIZE', 214_748_364_800),
  CARGO_USER_QUOTA: () => int('CARGO_USER_QUOTA', 214_748_364_800),
  CARGO_LINK_TTL_SECONDS: () => int('CARGO_LINK_TTL_SECONDS', 3600),
  CARGO_PENDING_TTL_SECONDS: () => int('CARGO_PENDING_TTL_SECONDS', 86_400),
  CARGO_MAX_FILENAME_LEN: () => int('CARGO_MAX_FILENAME_LEN', 255),
  LOG_LEVEL: () => (process.env.LOG_LEVEL ?? 'warning') as EnvShape['LOG_LEVEL'],
};

const cache = new Map<keyof EnvShape, unknown>();

export const env: EnvShape = new Proxy({} as EnvShape, {
  get(_t, key: string) {
    const k = key as keyof EnvShape;
    if (!(k in loaders)) return undefined;
    if (!cache.has(k)) cache.set(k, loaders[k]());
    return cache.get(k);
  },
});
