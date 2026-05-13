import { randomUUID } from 'node:crypto';
import { Server } from '@tus/server';
import { MemoryKvStore, type Upload } from '@tus/server';
import { EncryptedStore } from './encryptedStore.js';

export const kvStore = new MemoryKvStore<Upload>();

export const tusServer = new Server({
  path: '/api/tus',
  datastore: new EncryptedStore(kvStore),
  respectForwardedHeaders: true,
  // tus's default id is `randomBytes(16).toString('hex')` (no dashes). Force
  // UUIDs so the route's `isUuid()` guard and the blob fan-out path agree on
  // the id shape end-to-end.
  namingFunction: () => randomUUID(),
  async onUploadFinish(req, res, upload) {
    const store = (tusServer as unknown as { datastore: EncryptedStore }).datastore;
    const result = await store.onUploadFinish(upload.id);
    res.setHeader('Cargo-Transfer-Id', result.transfer_id);
    res.setHeader('Cargo-Share-Url', result.share_url);
    res.setHeader('Cargo-Status', result.status);
    if (result.expires_at) {
      res.setHeader('Cargo-Expires-At', result.expires_at);
    }
    if (result.pending_expires_at) {
      res.setHeader('Cargo-Pending-Expires-At', result.pending_expires_at);
    }
    return { res };
  },
});

/**
 * Storage object recorded on Upload.storage. The kvStore round-trips this
 * shape, so we can read sender_id back later for authorization checks.
 */
export interface UploadStorage {
  type: 'cargo-encrypted';
  path: string;
  sender_id: string;
}

export function readStorage(u: Upload | undefined): UploadStorage | null {
  if (!u) return null;
  const s = u.storage as Partial<UploadStorage> | undefined;
  if (!s || s.type !== 'cargo-encrypted' || typeof s.sender_id !== 'string') return null;
  return s as UploadStorage;
}
