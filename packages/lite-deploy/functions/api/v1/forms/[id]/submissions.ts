import { handleSubmit } from '@mmldigi/forms-core';
import type { Env } from '@mmldigi/forms-core';

export const onRequestPost: PagesFunction<Env, 'id'> = async ({ request, env, params }) => {
  return handleSubmit(request, env, params.id as string);
};
