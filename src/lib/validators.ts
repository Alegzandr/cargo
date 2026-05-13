// Discord post-2023 unified username grammar: lowercase alnum, dot, underscore,
// 2–32 chars. Single source of truth — used by tus create, the recipient PATCH,
// the Send form, and the Outbox edit dialog. The server normalizes input
// (trim, drop leading '@', lowercase) before matching, and stores the
// normalized form so Inbox lookups stay a plain equality.
export const HANDLE_RE = /^[a-z0-9_.]{2,32}$/;

export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@/, '').toLowerCase();
}

export function isValidHandle(raw: string): boolean {
  return HANDLE_RE.test(normalizeHandle(raw));
}
