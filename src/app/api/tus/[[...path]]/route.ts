import { Readable } from 'node:stream';
import type { IncomingMessage } from 'node:http';
import { withAuth } from '@/lib/auth/withAuth';
import { tusServer, kvStore, readStorage } from '@/lib/tus/server';
import { createNodeResponseStub } from '@/lib/tus/nodeResponse';
import { isUuid } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handle = withAuth(async (req, _ctx, user): Promise<Response> => {
  const userId = user.id;

  const url = new URL(req.url);
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => { headers[k] = v; });

  // Authorize PATCH/HEAD/GET/DELETE against the upload's recorded sender_id.
  // POST creates a new upload (no id in URL yet) — the store will stamp this
  // session as the sender. OPTIONS is preflight, no resource attached.
  const tail = url.pathname.replace(/^\/api\/tus\/?/, '');
  const uploadId = tail.length > 0 ? tail.split('/')[0] : null;
  if (uploadId && req.method !== 'POST' && req.method !== 'OPTIONS') {
    if (!isUuid(uploadId)) {
      return Response.json({ error: 'not_found' }, { status: 404 });
    }
    const existing = await kvStore.get(uploadId);
    const storage = readStorage(existing);
    if (storage && storage.sender_id !== userId) {
      // Don't leak existence — pretend the upload isn't there.
      return Response.json({ error: 'not_found' }, { status: 404 });
    }
  }

  // Inject the authenticated sender id into the upload metadata so the store
  // sees it without trusting the client. Tus's Upload-Metadata is comma-separated.
  const existingMeta = headers['upload-metadata'] ?? '';
  const encodedSender = `sender_id ${Buffer.from(userId).toString('base64')}`;
  headers['upload-metadata'] = existingMeta.length > 0 ? `${existingMeta},${encodedSender}` : encodedSender;

  const body: Readable | null = req.body ? Readable.fromWeb(req.body as never) : null;
  const nodeReq = Object.assign(body ?? Readable.from([]), {
    url: url.pathname + url.search,
    method: req.method,
    headers,
  }) as unknown as IncomingMessage;

  const { response, finished } = createNodeResponseStub();
  return new Promise<Response>((resolve, reject) => {
    finished.then(resolve);
    tusServer.handle(nodeReq, response).catch(reject);
  });
});

export const GET = handle;
export const POST = handle;
export const HEAD = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
