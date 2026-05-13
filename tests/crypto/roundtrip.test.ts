import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  ByteCounter,
  CRYPTO_CONSTANTS,
  newContentCipher,
  newContentDecipher,
  wrapDek,
  unwrapDek,
} from '../../src/lib/crypto/envelope.js';

describe('envelope encryption', () => {
  const masterKek = Buffer.alloc(32, 0xa5);
  const wrongKek = Buffer.alloc(32, 0x5a);

  it('round-trips a small plaintext', () => {
    const { dek, iv, cipher } = newContentCipher();
    const plaintext = Buffer.from('hello world');
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();

    expect(ciphertext.equals(plaintext)).toBe(false);
    expect(ciphertext.byteLength).toBe(plaintext.byteLength);

    const wrap = wrapDek(dek, masterKek);
    const dek2 = unwrapDek(wrap, masterKek);
    expect(dek2.equals(dek)).toBe(true);

    const decipher = newContentDecipher(dek2, iv, tag);
    const recovered = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    expect(recovered.equals(plaintext)).toBe(true);
  });

  it('round-trips a 50 MB random buffer', () => {
    const { dek, iv, cipher } = newContentCipher();
    const plaintext = randomBytes(50 * 1024 * 1024);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();

    expect(ciphertext.equals(plaintext)).toBe(false);

    const wrap = wrapDek(dek, masterKek);
    const dek2 = unwrapDek(wrap, masterKek);
    const decipher = newContentDecipher(dek2, iv, tag);
    const recovered = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    expect(recovered.equals(plaintext)).toBe(true);
  });

  it('throws when a single ciphertext byte is tampered with', () => {
    const { dek, iv, cipher } = newContentCipher();
    const plaintext = Buffer.from('the quick brown fox jumps over the lazy dog');
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();

    ciphertext[0] = ciphertext[0]! ^ 0xff;

    const decipher = newContentDecipher(dek, iv, tag);
    expect(() => Buffer.concat([decipher.update(ciphertext), decipher.final()])).toThrow();
  });

  it('throws when the auth tag is tampered with', () => {
    const { dek, iv, cipher } = newContentCipher();
    const plaintext = Buffer.from('tampered tag test');
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    tag[0] = tag[0]! ^ 0xff;

    const decipher = newContentDecipher(dek, iv, tag);
    expect(() => Buffer.concat([decipher.update(ciphertext), decipher.final()])).toThrow();
  });

  it('throws when unwrapping with the wrong master KEK', () => {
    const { dek } = newContentCipher();
    const wrap = wrapDek(dek, masterKek);
    expect(() => unwrapDek(wrap, wrongKek)).toThrow();
  });

  it('rejects a non-32B master KEK at wrap time', () => {
    const { dek } = newContentCipher();
    expect(() => wrapDek(dek, Buffer.alloc(16, 0))).toThrow(/32 bytes/);
  });

  it('ByteCounter passes bytes through unchanged and counts them', async () => {
    const counter = new ByteCounter();
    const chunks: Buffer[] = [];
    counter.on('data', (c: Buffer) => chunks.push(c));
    await pipeline(Readable.from([Buffer.from('abc'), Buffer.from('defgh')]), counter);
    expect(counter.bytes).toBe(8);
    expect(Buffer.concat(chunks).toString()).toBe('abcdefgh');
  });

  it('exposes the GCM constants used by the rest of the pipeline', () => {
    expect(CRYPTO_CONSTANTS.KEY_BYTES).toBe(32);
    expect(CRYPTO_CONSTANTS.IV_BYTES).toBe(12);
    expect(CRYPTO_CONSTANTS.TAG_BYTES).toBe(16);
  });
});
