import { requireUser, type AuthedUser } from './index.js';

// Tiny HOF that pulls the `requireUser() / instanceof Response` boilerplate out
// of every authenticated route. The handler is invoked with the resolved
// `user` and the original (req, ctx) — preserving Next.js's `{ params: Promise<…> }`
// shape for dynamic routes.
export function withAuth<C = unknown>(
  handler: (req: Request, ctx: C, user: AuthedUser) => Promise<Response>,
): (req: Request, ctx: C) => Promise<Response> {
  return async (req, ctx) => {
    const user = await requireUser();
    if (user instanceof Response) return user;
    return handler(req, ctx, user);
  };
}
