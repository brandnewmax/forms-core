import { handleTranslateSchema } from '@mmldigi/forms-core';
import type { Env } from '@mmldigi/forms-core';

export const onRequestPost: PagesFunction<Env, 'id'> = async ({ request, env, params }) => {
  return handleTranslateSchema(request, env, params.id as string);
};
