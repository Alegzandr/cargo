import { createHmac, randomBytes } from 'node:crypto';

// Salt rotates per process — hashes are uncorrelatable across boots.
const PROCESS_SALT = randomBytes(32);

export function hashIdentifier(value: string | null | undefined): Buffer {
  return createHmac('sha256', PROCESS_SALT).update(value ?? '').digest();
}

interface SessionMemo {
  sessionId: string;
  ip_hash: Buffer;
  ua_hash: Buffer;
  bytes_sent: number;
  started_at: number;
  rangeReopens: number;
  controller: AbortController;
}

const sessionsByTransfer = new Map<string, SessionMemo[]>();

// Thresholds are intentionally not env-tunable. They encode product policy
// (legitimate downloads complete well inside 6h; one Cargo link has one IP at
// a time; 50 MiB/s is wider than any home connection) rather than per-deploy
// capacity. Operators who need to tighten or loosen them should change the
// values here — exposing them as env would invite ad-hoc tuning that drifts
// from the assumptions the rest of the abuse detector is written against.
const BANDWIDTH_LIMIT_BYTES_PER_SEC = 50 * 1024 * 1024;
const DIVERGENCE_WINDOW_MS = 30_000;
const MAX_RANGE_REOPENS = 4;
const RANGE_WINDOW_MS = 60_000;
// A memo this old has no business being in memory. Sweep on each beginSession.
const MEMO_HARD_CAP_MS = 6 * 60 * 60 * 1000;
// Defensive ceiling on parallel sessions per transfer. Beyond this we refuse
// new sessions outright — much higher than legitimate use and below any value
// that could exhaust the process.
const MAX_MEMOS_PER_TRANSFER = 64;

function sweepStale(now: number): void {
  for (const [tid, list] of sessionsByTransfer) {
    const kept = list.filter((s) => now - s.started_at < MEMO_HARD_CAP_MS);
    if (kept.length === 0) sessionsByTransfer.delete(tid);
    else if (kept.length !== list.length) sessionsByTransfer.set(tid, kept);
  }
}

export interface BeginArgs {
  transferId: string;
  sessionId: string;
  ipHash: Buffer;
  uaHash: Buffer;
  isRangeRequest: boolean;
}

export interface BeginResult {
  controller: AbortController;
  killReason?: 'diverged' | 'range_abuse' | 'too_many';
}

export function beginSession(args: BeginArgs): BeginResult {
  const now = Date.now();
  sweepStale(now);
  const list = sessionsByTransfer.get(args.transferId) ?? [];
  const recent = list.filter((s) => now - s.started_at < DIVERGENCE_WINDOW_MS);
  const distinctIps = new Set<string>([args.ipHash.toString('base64'), ...recent.map((s) => s.ip_hash.toString('base64'))]);

  const controller = new AbortController();
  const memo: SessionMemo = {
    sessionId: args.sessionId,
    ip_hash: args.ipHash,
    ua_hash: args.uaHash,
    bytes_sent: 0,
    started_at: now,
    rangeReopens: args.isRangeRequest ? 1 : 0,
    controller,
  };

  if (list.length >= MAX_MEMOS_PER_TRANSFER) {
    controller.abort();
    return { controller, killReason: 'too_many' };
  }

  list.push(memo);
  sessionsByTransfer.set(args.transferId, list);

  if (distinctIps.size > 1) {
    // Kill *new* session, keep the original.
    controller.abort();
    return { controller, killReason: 'diverged' };
  }

  if (args.isRangeRequest) {
    const recentRange = list.filter((s) => now - s.started_at < RANGE_WINDOW_MS && s.rangeReopens > 0);
    if (recentRange.length > MAX_RANGE_REOPENS) {
      controller.abort();
      return { controller, killReason: 'range_abuse' };
    }
  }

  return { controller };
}

export function tick(args: { transferId: string; sessionId: string; bytesDelta: number }): 'ok' | 'bandwidth' {
  const list = sessionsByTransfer.get(args.transferId);
  if (!list) return 'ok';
  const memo = list.find((s) => s.sessionId === args.sessionId);
  if (!memo) return 'ok';
  memo.bytes_sent += args.bytesDelta;
  const elapsedSec = Math.max(1, (Date.now() - memo.started_at) / 1000);
  const rate = memo.bytes_sent / elapsedSec;
  // No 10s warm-up — small files were never reaching it. The 1-second floor on
  // elapsedSec already absorbs the first-burst noise, and the limit (50 MiB/s)
  // is high enough that a legitimate connection won't trip it.
  if (rate > BANDWIDTH_LIMIT_BYTES_PER_SEC) {
    memo.controller.abort();
    return 'bandwidth';
  }
  return 'ok';
}

export function endSession(transferId: string, sessionId: string): void {
  const list = sessionsByTransfer.get(transferId);
  if (!list) return;
  const filtered = list.filter((s) => s.sessionId !== sessionId);
  if (filtered.length === 0) sessionsByTransfer.delete(transferId);
  else sessionsByTransfer.set(transferId, filtered);
}

export function _resetForTests(): void {
  sessionsByTransfer.clear();
}
