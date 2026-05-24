import { handleListSubmissions } from '@mmldigi/forms-core';
import type { Env } from '@mmldigi/forms-core';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  return handleListSubmissions(request, env);
};
