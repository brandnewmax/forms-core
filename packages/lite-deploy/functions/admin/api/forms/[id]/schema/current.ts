import { handleGetCurrentSchema } from '@mmldigi/forms-core';
import type { Env } from '@mmldigi/forms-core';

export const onRequestGet: PagesFunction<Env, 'id'> = async ({ request, env, params }) => {
  return handleGetCurrentSchema(request, env, params.id as string);
};
