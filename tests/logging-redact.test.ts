import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

// Set required envs before importing the logger module.
process.env.DATABASE_URL ??= 'postgres://test:test@localhost/test';
process.env.AUTH_SECRET ??= 'x'.repeat(32);
process.env.AUTH_DISCORD_ID ??= 'test';
process.env.AUTH_DISCORD_SECRET ??= 'test';
process.env.CARGO_MASTER_KEY ??= 'base64:' + Buffer.alloc(32, 0xaa).toString('base64');
process.env.LOG_LEVEL = 'debug';

const { log } = await import('../src/lib/log/index.js');

describe('logger PII redaction', () => {
  let stderrChunks: string[];
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrChunks = [];
    writeSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation((chunk: string | Uint8Array): boolean => {
        stderrChunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
        return true;
      });
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  it('strips forbidden keys from ctx', () => {
    log.warn('quota.exceeded', {
      user_id: '00000000-0000-0000-0000-000000000001',
      filename: 'secret-payroll.xlsx',
      transfer_id: '00000000-0000-0000-0000-000000000002',
      handle: 'alice',
      ip: '203.0.113.5',
      keep_me: 7,
    });
    const all = stderrChunks.join('');
    expect(all).toContain('"evt":"quota.exceeded"');
    expect(all).toContain('"keep_me":7');
    expect(all).not.toContain('secret-payroll');
    expect(all).not.toContain('alice');
    expect(all).not.toContain('203.0.113.5');
    expect(all).not.toMatch(/00000000-0000-0000-0000-000000000001/);
  });

  it('maps unknown evt names to "uncaught"', () => {
    log.error('made.up.event', { class: 'Error' });
    const all = stderrChunks.join('');
    expect(all).toContain('"evt":"uncaught"');
    expect(all).not.toContain('made.up.event');
  });

  it('drops long strings even on allowed keys', () => {
    log.warn('cleanup.cycle', { description: 'x'.repeat(200) });
    const all = stderrChunks.join('');
    expect(all).toContain('redacted-long-string');
  });

  it('emits an event with no ctx without crashing', () => {
    log.info('boot.ok');
    const all = stderrChunks.join('');
    expect(all).toContain('"evt":"boot.ok"');
    expect(all).toContain('"ctx":{}');
  });
});
