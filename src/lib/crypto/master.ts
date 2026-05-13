const PREFIX = 'base64:';

function decodeMasterKey(raw: string | undefined): Buffer {
  if (!raw || raw.length === 0) {
    throw new Error('CARGO_MASTER_KEY is required to encrypt/decrypt blobs');
  }
  const b64 = raw.startsWith(PREFIX) ? raw.slice(PREFIX.length) : raw;
  let buf: Buffer;
  try {
    buf = Buffer.from(b64, 'base64');
  } catch {
    throw new Error('CARGO_MASTER_KEY is not valid base64');
  }
  if (buf.byteLength !== 32) {
    throw new Error(
      `CARGO_MASTER_KEY must decode to exactly 32 bytes (got ${buf.byteLength}). Generate with: head -c 32 /dev/urandom | base64`,
    );
  }
  // Reject the all-zero key in production. The dev compose file ships an
  // all-zero placeholder; if it ever leaks into a prod deployment the operator
  // gets a hard fail at boot rather than silently encrypting under the most
  // recognizable key on earth.
  if (process.env.NODE_ENV === 'production' && buf.every((b) => b === 0)) {
    throw new Error('CARGO_MASTER_KEY is the all-zero placeholder; refusing to boot in production');
  }
  return buf;
}

// Loaded once. Held in memory only. Read process.env directly so the env
// module (which the worker imports) doesn't force this key to be present.
export const MASTER_KEK: Buffer = decodeMasterKey(process.env.CARGO_MASTER_KEY);
