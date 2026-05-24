import { handleSubmit } from '@mmldigi/forms-core';
import type { Env } from '@mmldigi/forms-core';

export const onRequestPost: PagesFunction<Env, 'id'> = async (context) => {
  // Forward the full context so handleSubmit can use context.waitUntil()
  // to offload afterStore hooks (Feishu sync, email, etc.) without blocking
  // the response in production.
  return handleSubmit(context.request, context.env, context.params.id as string, context);
};
