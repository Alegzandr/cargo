import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { and, eq, inArray, lt, or } from 'drizzle-orm';
import { db } from '../lib/db/client.js';
import { transfers, downloadSessions, TRANSFER_STATUS } from '../lib/db/schema.js';
import { env } from '../lib/env.js';
import { log } from '../lib/log/index.js';
import { purgeTransfer } from '../lib/transfers/purge.js';

// Hard safety cap for sessions that never end cleanly (e.g. a half-open TCP
// connection holding the row hostage). Same value as in docs/PRIVACY.md.
const HARD_CAP_MS = 24 * 60 * 60 * 1000;
const TICK_MS = 5 * 60 * 1000;
const PURGE_CONCURRENCY = 50;
const ORPHAN_IN_CHUNK = 1000;

async function unlinkBlob(relativePath: string): Promise<void> {
  try {
    await fs.unlink(join(env.CARGO_BLOB_PATH, relativePath));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}

/**
 * The single rule: a transfer is purged when it's past `expires_at` AND no
 * `download_sessions` row references it. The download route handles the same
 * inline when the last session ends — the worker exists for the race-window
 * where no session was ever opened, and as a safety net.
 *
 * The 24h hard cap exists only as a fallback against stuck (never-closing)
 * sessions; nothing else should ever live past it.
 */
async function tick(): Promise<void> {
  const now = new Date();
  const hardCap = new Date(now.getTime() - HARD_CAP_MS);
  let purged = 0;
  let freedBytes = 0;

  const candidates = await db
    .select({
      id: transfers.id,
      sender_id: transfers.sender_id,
      size_bytes: transfers.size_bytes,
      blob_path: transfers.blob_path,
      status: transfers.status,
      expires_at: transfers.expires_at,
      pending_expires_at: transfers.pending_expires_at,
    })
    .from(transfers)
    .where(
      or(
        // Delivered rows past their 1h download window.
        lt(transfers.expires_at, now),
        // Pending rows that were never claimed before pending_expires_at.
        // Hard-deleted with no tombstone — sender just sees them disappear.
        and(
          eq(transfers.status, TRANSFER_STATUS.PENDING),
          lt(transfers.pending_expires_at, now),
        ),
      ),
    );

  if (candidates.length === 0) {
    log.info('cleanup.cycle', { purged: 0, freed_bytes: 0 });
    return;
  }

  const ids = candidates.map((t) => t.id);
  const active = await db
    .select({ transfer_id: downloadSessions.transfer_id })
    .from(downloadSessions)
    .where(inArray(downloadSessions.transfer_id, ids));
  const activeSet = new Set(active.map((a) => a.transfer_id));

  const toPurge = candidates.filter((t) => {
    // Pending rows have no in-flight download to protect — purge as soon as
    // the unclaimed TTL fires.
    if (t.status === TRANSFER_STATUS.PENDING) return true;
    if (t.expires_at && t.expires_at.getTime() < hardCap.getTime()) return true; // override the in-flight gate
    return !activeSet.has(t.id);
  });

  // Isolate failures: a single bad row (transient DB error, missing blob
  // shard, FS hiccup) must not abort the rest of the cycle. The next tick
  // will retry whatever didn't make it. Batched to bound concurrent
  // transactions against Postgres.
  for (let i = 0; i < toPurge.length; i += PURGE_CONCURRENCY) {
    const batch = toPurge.slice(i, i + PURGE_CONCURRENCY);
    await Promise.all(
      batch.map(async (t) => {
        try {
          await purgeTransfer(t);
          purged++;
          freedBytes += t.size_bytes;
        } catch (err) {
          log.error('db.error', { code: (err as { code?: string }).code ?? 'purge' });
        }
      }),
    );
  }

  log.info('cleanup.cycle', { purged, freed_bytes: freedBytes });

  try {
    const shards = await fs.readdir(env.CARGO_BLOB_PATH, { withFileTypes: true });
    const dirShards = shards.filter((s) => s.isDirectory());
    const shardFiles = await Promise.all(
      dirShards.map((s) =>
        fs.readdir(join(env.CARGO_BLOB_PATH, s.name)).then((files) => files.map((f) => `${s.name}/${f}`)),
      ),
    );
    const onDisk: string[] = shardFiles.flat();
    if (onDisk.length === 0) return;
    const stems = onDisk.map((p) => p.split('/').pop()!).filter(Boolean);
    // Chunk the WHERE IN so the planner doesn't choke on huge inlined lists.
    const known = new Set<string>();
    for (let i = 0; i < stems.length; i += ORPHAN_IN_CHUNK) {
      const chunk = stems.slice(i, i + ORPHAN_IN_CHUNK);
      const rows = await db.select({ id: transfers.id }).from(transfers).where(inArray(transfers.id, chunk));
      for (const r of rows) known.add(r.id);
    }
    const orphans = onDisk.filter((rel) => !known.has(rel.split('/').pop()!));
    await Promise.all(
      orphans.map(async (rel) => {
        await unlinkBlob(rel);
        log.info('cleanup.orphan_removed');
      }),
    );
  } catch (err) {
    log.error('db.error', { code: (err as { code?: string }).code ?? 'orphan_scan' });
  }
}

async function main(): Promise<void> {
  log.info('boot.ok', { workers: 1 });
  while (true) {
    try {
      await tick();
    } catch (err) {
      log.error('uncaught', { class: (err as Error).constructor.name });
    }
    await new Promise((r) => setTimeout(r, TICK_MS));
  }
}

main().catch((err) => {
  log.error('uncaught', { class: (err as Error).constructor.name });
  process.exit(1);
});
