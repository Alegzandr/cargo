import { describe, expect, it } from 'vitest';

// Required env scaffolding.
process.env.DATABASE_URL ??= 'postgres://test:test@localhost/test';
process.env.AUTH_SECRET ??= 'x'.repeat(32);
process.env.AUTH_DISCORD_ID ??= 'test';
process.env.AUTH_DISCORD_SECRET ??= 'test';
process.env.CARGO_MASTER_KEY ??= 'base64:' + Buffer.alloc(32, 0xaa).toString('base64');

const { noteClaim, takeClaim } = await import('../src/lib/auth/recentClaims.js');

describe('recentClaims (inbox welcome stash)', () => {
  it('returns 0 when no claim was recorded', () => {
    expect(takeClaim('never-seen')).toBe(0);
  });

  it('returns the recorded count and clears the entry (read-and-clear)', () => {
    noteClaim('did1', 3);
    expect(takeClaim('did1')).toBe(3);
    // Second read sees the cleared state — single-shot semantics.
    expect(takeClaim('did1')).toBe(0);
  });

  it('overwrites an earlier note for the same discord id', () => {
    noteClaim('did2', 1);
    noteClaim('did2', 5);
    expect(takeClaim('did2')).toBe(5);
  });

  it('ignores non-positive counts (no spurious card on zero matches)', () => {
    noteClaim('did3', 0);
    noteClaim('did3', -2);
    expect(takeClaim('did3')).toBe(0);
  });
});
