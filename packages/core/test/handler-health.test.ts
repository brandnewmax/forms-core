import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { handleHealth } from '../src/api-handlers/health.js';

describe('handleHealth', () => {
  it('returns 200 OK with status payload', async () => {
    const baseEnv = { ...env, ALLOWED_ORIGINS: '*', ENVIRONMENT: 'development' } as any;
    const resp = await handleHealth(new Request('https://api.test/api/v1/health'), baseEnv);
    expect(resp.status).toBe(200);
    const body = await resp.json() as any;
    expect(body.status).toBe('ok');
    expect(body.environment).toBe('development');
    expect(body.dbReachable).toBe(true);
  });
});
