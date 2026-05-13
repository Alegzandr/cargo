import { env } from '../env.js';

type Level = 'debug' | 'info' | 'warning' | 'error';

const LEVEL_RANK: Record<Level, number> = { debug: 10, info: 20, warning: 30, error: 40 };

const ALLOWED_EVENTS = new Set<string>([
  'boot.ok',
  'boot.master_key_invalid',
  'db.error',
  'tus.chunk_rejected',
  'transfer.decrypt_failed',
  'quota.exceeded',
  'abuse.session_diverged',
  'abuse.session_killed',
  'cleanup.cycle',
  'cleanup.orphan_removed',
  'migrate.failed',
  'uncaught',
]);

// Keys that, if present anywhere in a ctx, get dropped before emit. Defense-in-depth
// against accidental leakage from callsites.
const FORBIDDEN_CTX_KEYS = new Set<string>([
  'user_id', 'userId',
  'transfer_id', 'transferId',
  'filename',
  'discord_id', 'discordId',
  'username', 'handle',
  'global_name',
  'ip', 'ip_address',
  'user_agent', 'userAgent',
  'email',
]);

function redactCtx(ctx: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!ctx) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (FORBIDDEN_CTX_KEYS.has(k)) continue;
    const t = typeof v;
    if (t === 'number' || t === 'boolean') {
      out[k] = v;
    } else if (t === 'string') {
      out[k] = (v as string).length <= 32 ? v : '<redacted-long-string>';
    }
  }
  return out;
}

function emit(level: Level, evt: string, ctx?: Record<string, unknown>): void {
  if (LEVEL_RANK[level] < LEVEL_RANK[env.LOG_LEVEL]) return;
  const safeEvt = ALLOWED_EVENTS.has(evt) ? evt : 'uncaught';
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    lvl: level,
    evt: safeEvt,
    ctx: redactCtx(ctx),
  });
  process.stderr.write(line + '\n');
}

export const log = {
  debug: (evt: string, ctx?: Record<string, unknown>) => emit('debug', evt, ctx),
  info: (evt: string, ctx?: Record<string, unknown>) => emit('info', evt, ctx),
  warn: (evt: string, ctx?: Record<string, unknown>) => emit('warning', evt, ctx),
  error: (evt: string, ctx?: Record<string, unknown>) => emit('error', evt, ctx),
};
