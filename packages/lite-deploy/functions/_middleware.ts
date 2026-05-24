import { handlePreflight } from '@mmldigi/forms-core';
import type { Env } from '@mmldigi/forms-core';

export const onRequestOptions: PagesFunction<Env> = async ({ request, env }) => {
  return handlePreflight(request, env.ALLOWED_ORIGINS);
};
