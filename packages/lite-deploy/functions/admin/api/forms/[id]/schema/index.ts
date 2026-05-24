import { handleCreateSchemaVersion } from '@mmldigi/forms-core';
import type { Env } from '@mmldigi/forms-core';

export const onRequestPost: PagesFunction<Env, 'id'> = async ({ request, env, params, data }) => {
  const createdBy = ((data as Record<string, unknown>)?.user as string | undefined) ?? null;
  return handleCreateSchemaVersion(request, env, params.id as string, createdBy);
};
