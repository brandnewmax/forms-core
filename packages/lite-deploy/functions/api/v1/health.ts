import { handleHealth } from '@mmldigi/forms-core';
import type { Env } from '@mmldigi/forms-core';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  return handleHealth(request, env);
};
