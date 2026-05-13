// In-process record of "you just claimed N pending transfers at sign-in".
// The inbox welcome card reads-and-clears this once after a fresh sign-in.
//
// Cargo runs on a single host (CLAUDE.md), so a process-local Map is fine —
// no cross-node coordination needed. Entries are TTL'd defensively so a sign-
// in that never produces an inbox visit doesn't keep state around forever.
const TTL_MS = 5 * 60 * 1000;

interface Entry {
  count: number;
  at: number;
}

const byDiscordId = new Map<string, Entry>();

export function noteClaim(discordId: string, count: number): void {
  if (count <= 0) return;
  byDiscordId.set(discordId, { count, at: Date.now() });
}

/** Returns the claim count and deletes the entry. Returns 0 if none/expired. */
export function takeClaim(discordId: string): number {
  const e = byDiscordId.get(discordId);
  if (!e) return 0;
  byDiscordId.delete(discordId);
  if (Date.now() - e.at > TTL_MS) return 0;
  return e.count;
}
