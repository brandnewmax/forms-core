import { requireAuth } from '@mmldigi/forms-core';
import type { Env } from '@mmldigi/forms-core';

export const onRequest: PagesFunction<Env> = async ({ request, env, next }) => {
  if (!env.SESSION_SECRET) {
    return new Response('Auth not configured', { status: 500 });
  }
  const { user, response } = await requireAuth(request, env.SESSION_SECRET, { jsonOn401: true });
  if (!user) return response!;
  return next();
};
