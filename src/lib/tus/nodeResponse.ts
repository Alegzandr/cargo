import { EventEmitter } from 'node:events';
import type { ServerResponse } from 'node:http';

export interface NodeResponseStub {
  response: ServerResponse;
  finished: Promise<Response>;
}

// The tus server expects a real ServerResponse: it calls setHeader/write/end
// AND attaches lifecycle listeners (`res.on('finish', …)`) inside server.write().
// We extend EventEmitter so those listeners don't throw, and emit 'finish' from
// end() so the tus server's post-response cleanup runs. The returned `finished`
// promise resolves to a Fetch Response once tus calls end().
export function createNodeResponseStub(): NodeResponseStub {
  const chunks: Buffer[] = [];
  const resHeaders: Record<string, string> = {};
  let statusCode = 200;
  let settled = false;
  let resolveFn!: (r: Response) => void;
  const finished = new Promise<Response>((resolve) => {
    resolveFn = resolve;
  });

  const stub = Object.assign(new EventEmitter(), {
    setHeader(k: string, v: string | number) {
      resHeaders[k.toLowerCase()] = String(v);
    },
    getHeader(k: string) {
      return resHeaders[k.toLowerCase()];
    },
    removeHeader(k: string) {
      delete resHeaders[k.toLowerCase()];
    },
    writeHead(status: number, hdrs?: Record<string, string>) {
      statusCode = status;
      if (hdrs) for (const [k, v] of Object.entries(hdrs)) resHeaders[k.toLowerCase()] = v;
      return stub;
    },
    write(chunk: string | Buffer) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      return true;
    },
    end(chunk?: string | Buffer) {
      if (chunk) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      if (!settled) {
        // 204/205/304 forbid a response body per the Fetch spec — passing even
        // an empty Buffer makes the Response constructor throw, which would
        // leave the outer Promise unresolved and hang the client.
        const nullBody = statusCode === 204 || statusCode === 205 || statusCode === 304;
        const body = nullBody ? null : Buffer.concat(chunks);
        resolveFn(new Response(body, { status: statusCode, headers: resHeaders }));
        settled = true;
      }
      stub.emit('finish');
      return stub;
    },
    get statusCode() {
      return statusCode;
    },
  });

  return { response: stub as unknown as ServerResponse, finished };
}
