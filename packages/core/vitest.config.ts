import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config';
import path from 'node:path';

export default defineWorkersConfig(async () => {
  const migrationsPath = path.join(__dirname, 'test');
  const migrations = await readD1Migrations(migrationsPath);

  return {
    test: {
      setupFiles: ['./test/apply-migrations.ts'],
      poolOptions: {
        workers: {
          miniflare: {
            compatibilityDate: '2024-05-01',
            compatibilityFlags: ['nodejs_compat'],
            d1Databases: ['DB'],
            kvNamespaces: ['RATE_LIMIT_KV'],
            bindings: { TEST_MIGRATIONS: migrations },
          },
        },
      },
    },
  };
});
