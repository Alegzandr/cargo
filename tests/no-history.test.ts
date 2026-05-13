import { describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Load-bearing privacy assertion.
 *
 * If a future migration introduces an `audit_logs`, `activity`, `events`,
 * `download_history` (or similar) table, this test will fail loudly. The fix
 * is to STOP, discuss in docs/PRIVACY.md, and only then explicitly update
 * the expected set below.
 *
 * The check runs against the Drizzle schema source rather than a live DB
 * because schema is the contract — a row in the DB is downstream of it.
 */
describe('privacy: no history-shaped tables in the schema', () => {
  it('exposes exactly { users, transfers, downloadSessions } from schema.ts', async () => {
    const schemaPath = path.resolve(__dirname, '..', 'src/lib/db/schema.ts');
    const src = await fs.readFile(schemaPath, 'utf8');

    // Capture every pgTable('name', …) declaration. The first string literal
    // arg is the on-disk table name. We forbid anything that looks like an
    // event sink.
    const tableNames = Array.from(src.matchAll(/pgTable\(\s*'([^']+)'/g)).map((m) => m[1]);
    expect(new Set(tableNames)).toEqual(new Set(['users', 'transfers', 'download_sessions']));

    const FORBIDDEN_PATTERNS = [/audit_log/i, /\bactivity\b/i, /\bevents?\b/i, /history/i];
    for (const name of tableNames) {
      for (const pat of FORBIDDEN_PATTERNS) {
        expect(name).not.toMatch(pat);
      }
    }
  });

  it('pending transfers have an explicit unclaimed-TTL column so the cleanup worker can hard-delete them', async () => {
    // The pending lifecycle is privacy-load-bearing: a transfer addressed to
    // a handle that never signs in must not linger as a dormant blob. The
    // worker keys on `pending_expires_at`; if a future refactor drops it,
    // unclaimed transfers would accumulate indefinitely. This guards that.
    const schemaPath = path.resolve(__dirname, '..', 'src/lib/db/schema.ts');
    const src = await fs.readFile(schemaPath, 'utf8');
    expect(src).toMatch(/pending_expires_at/);
    expect(src).toMatch(/PENDING:\s*'pending'/);
  });

  it('does not reference an audit_logs / activity / events insert anywhere in src/', async () => {
    const root = path.resolve(__dirname, '..', 'src');
    const offenders: string[] = [];
    async function walk(dir: string): Promise<void> {
      for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) { await walk(p); continue; }
        if (!/\.(ts|tsx)$/.test(entry.name)) continue;
        const src = await fs.readFile(p, 'utf8');
        if (/audit_logs|insertAuditLog|recordActivity|writeEvent/i.test(src)) offenders.push(p);
      }
    }
    await walk(root);
    expect(offenders).toEqual([]);
  });
});
