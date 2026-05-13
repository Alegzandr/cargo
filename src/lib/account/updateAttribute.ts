// Shared body of the locale/theme PATCH endpoints: parse JSON, validate the
// new value, run a typed DB update, and mirror it into a long-lived cookie so
// SSR can pick up the preference before the next session read.
export async function patchUserAttribute<V extends string>(opts: {
  req: Request;
  field: string;
  validate: (v: unknown) => v is V;
  update: (v: V) => Promise<unknown>;
  cookieName: string;
}): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await opts.req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'internal' }, { status: 400 });
  }
  const value = body[opts.field];
  if (!opts.validate(value)) {
    return Response.json({ error: 'internal' }, { status: 400 });
  }
  await opts.update(value);
  const res = Response.json({ ok: true });
  res.headers.append(
    'Set-Cookie',
    `${opts.cookieName}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`,
  );
  return res;
}
