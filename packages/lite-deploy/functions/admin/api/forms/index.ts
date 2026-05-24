import { handleListForms, handleCreateForm } from '@mmldigi/forms-core';
import type { Env } from '@mmldigi/forms-core';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  return handleListForms(request, env);
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  return handleCreateForm(request, env);
};
