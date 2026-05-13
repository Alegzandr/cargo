import NextAuth, { type Session } from 'next-auth';
import Discord from 'next-auth/providers/discord';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { env } from '../env.js';
import { claimPendingTransfers } from '../transfers/claim.js';

interface DiscordProfile {
  id: string;
  username?: string;
  global_name?: string | null;
  avatar?: string | null;
}

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      discord_id: string;
      username: string;
      global_name: string | null;
      avatar_url: string | null;
      locale: 'en' | 'fr';
      theme: 'dark' | 'light';
    };
  }
}

export type AuthedUser = NonNullable<Session['user']>;

declare module '@auth/core/jwt' {
  interface JWT {
    id?: string;
    discord_id?: string;
    username?: string;
    global_name?: string | null;
    avatar_url?: string | null;
    locale?: 'en' | 'fr';
    tv?: number;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 30 },
  providers: [
    Discord({
      clientId: env.AUTH_DISCORD_ID,
      clientSecret: env.AUTH_DISCORD_SECRET,
      // Explicit `url` is required: Auth.js's deep-merge replaces the string
      // default with `{}` when an object is passed, losing the endpoint URL and
      // making it fall back to OIDC discovery on a provider without an issuer.
      authorization: {
        url: 'https://discord.com/api/oauth2/authorize',
        params: { scope: 'identify' },
      },
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      if (!profile?.id || typeof profile.id !== 'string') return false;
      const p = profile as DiscordProfile;
      const discordId = p.id;
      // Discord's post-2023 unified usernames are lowercase, but the API can
      // still return mixed case for legacy accounts. Senders address transfers
      // with a lowercased handle (see encryptedStore.create()) so we must
      // normalize here too — otherwise a recipient with `Alice` never
      // matches the stored `alice` and their inbox is silently empty.
      const username = (p.username ?? discordId).toLowerCase();
      const globalName = p.global_name ?? null;
      const avatar_url = p.avatar ? `https://cdn.discordapp.com/avatars/${discordId}/${p.avatar}.png` : null;

      await db
        .insert(users)
        .values({
          discord_id: discordId,
          username,
          global_name: globalName,
          avatar_url,
        })
        .onConflictDoUpdate({
          target: users.discord_id,
          set: {
            username,
            global_name: globalName,
            avatar_url,
          },
        });
      await claimPendingTransfers(discordId, username);
      return true;
    },
    async jwt({ token, profile }) {
      if (profile?.id && typeof profile.id === 'string') {
        const row = await db.select().from(users).where(eq(users.discord_id, profile.id)).limit(1);
        const u = row[0];
        if (u) {
          token.id = u.id;
          token.discord_id = u.discord_id;
          token.username = u.username;
          token.global_name = u.global_name;
          token.avatar_url = u.avatar_url;
          token.locale = u.locale as 'en' | 'fr';
          token.tv = u.token_version;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (!token.id) return session;
      // Re-validate against the DB on every session read. If the user row is
      // gone (account deleted) or the embedded token_version is stale (e.g. a
      // future invalidation event), the session is treated as anonymous and
      // every protected endpoint will 401. This is what closes the "JWT
      // outlives delete" gap; the cost is one indexed lookup per auth() call.
      const row = await db
        .select({
          id: users.id,
          discord_id: users.discord_id,
          username: users.username,
          global_name: users.global_name,
          avatar_url: users.avatar_url,
          locale: users.locale,
          theme: users.theme,
          token_version: users.token_version,
        })
        .from(users)
        .where(eq(users.id, token.id))
        .limit(1);
      const u = row[0];
      if (!u || (typeof token.tv === 'number' && token.tv !== u.token_version)) {
        // Anonymous — callers see session.user.id === undefined.
        return { ...session, user: undefined as unknown as Session['user'] };
      }
      // email / emailVerified are required by next-auth's AdapterUser base type
      // even though we run JWT-only with `scope: identify` (no email). Stub them
      // so the merged session.user shape typechecks; nothing in the app reads them.
      session.user = {
        id: u.id,
        discord_id: u.discord_id,
        username: u.username,
        global_name: u.global_name,
        avatar_url: u.avatar_url,
        locale: u.locale as 'en' | 'fr',
        theme: u.theme as 'dark' | 'light',
        email: '',
        emailVerified: null,
      };
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
});

export async function requireUser(): Promise<AuthedUser | Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'unauthenticated' }, { status: 401 });
  }
  return session.user;
}
