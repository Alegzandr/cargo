import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Transform, type TransformCallback } from 'node:stream';

const ALG = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

export interface WrappedDek {
  dek_wrapped: Buffer;
  dek_wrap_iv: Buffer;
  dek_wrap_tag: Buffer;
}

export interface EncryptInit {
  dek: Buffer;
  iv: Buffer;
  cipher: import('node:crypto').CipherGCM;
}

/** Random 32-byte DEK + 12-byte IV, ready to stream-encrypt one file. */
export function newContentCipher(): EncryptInit {
  const dek = randomBytes(KEY_BYTES);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALG, dek, iv) as import('node:crypto').CipherGCM;
  return { dek, iv, cipher };
}

/** Wrap a per-file DEK under the master KEK. */
export function wrapDek(dek: Buffer, masterKek: Buffer): WrappedDek {
  if (dek.byteLength !== KEY_BYTES) throw new Error('DEK must be 32 bytes');
  if (masterKek.byteLength !== KEY_BYTES) throw new Error('master KEK must be 32 bytes');
  const wrap_iv = randomBytes(IV_BYTES);
  const wrapper = createCipheriv(ALG, masterKek, wrap_iv) as import('node:crypto').CipherGCM;
  const dek_wrapped = Buffer.concat([wrapper.update(dek), wrapper.final()]);
  const dek_wrap_tag = wrapper.getAuthTag();
  return { dek_wrapped, dek_wrap_iv: wrap_iv, dek_wrap_tag };
}

/** Unwrap a previously-wrapped DEK. Throws on auth-tag mismatch. */
export function unwrapDek(wrapped: WrappedDek, masterKek: Buffer): Buffer {
  if (masterKek.byteLength !== KEY_BYTES) throw new Error('master KEK must be 32 bytes');
  const dec = createDecipheriv(ALG, masterKek, wrapped.dek_wrap_iv) as import('node:crypto').DecipherGCM;
  dec.setAuthTag(wrapped.dek_wrap_tag);
  const dek = Buffer.concat([dec.update(wrapped.dek_wrapped), dec.final()]);
  if (dek.byteLength !== KEY_BYTES) throw new Error('DEK unwrap produced wrong length');
  return dek;
}

/** Open a streaming decipher with the unwrapped DEK and a stored content IV/tag. */
export function newContentDecipher(dek: Buffer, iv: Buffer, tag: Buffer): import('node:crypto').DecipherGCM {
  if (dek.byteLength !== KEY_BYTES) throw new Error('DEK must be 32 bytes');
  if (iv.byteLength !== IV_BYTES) throw new Error('content IV must be 12 bytes');
  if (tag.byteLength !== TAG_BYTES) throw new Error('content tag must be 16 bytes');
  const dec = createDecipheriv(ALG, dek, iv) as import('node:crypto').DecipherGCM;
  dec.setAuthTag(tag);
  return dec;
}

/**
 * A pass-through that counts bytes flowing through it. Used in the download
 * path to feed the abuse detector without buffering the body.
 */
export class ByteCounter extends Transform {
  bytes = 0;
  override _transform(chunk: Buffer, _enc: BufferEncoding, cb: TransformCallback): void {
    this.bytes += chunk.byteLength;
    cb(null, chunk);
  }
}

export const CRYPTO_CONSTANTS = { ALG, IV_BYTES, TAG_BYTES, KEY_BYTES } as const;
