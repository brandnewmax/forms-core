import { handleGetSettings, handleUpdateSettings } from '@mmldigi/forms-core';
import type { Env } from '@mmldigi/forms-core';

export const onRequestGet: PagesFunction<Env, 'id'> = async ({ request, env, params }) => {
  return handleGetSettings(request, env, params.id as string);
};

export const onRequestPut: PagesFunction<Env, 'id'> = async ({ request, env, params }) => {
  return handleUpdateSettings(request, env, params.id as string);
};
