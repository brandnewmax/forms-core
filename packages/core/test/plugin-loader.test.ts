import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerPlugin,
  unregisterAll,
  runHook,
  getRegisteredPlugins,
} from '../src/plugin-loader.js';
import type { FormsPlugin, SubmitCtx, Submission } from '../src/index.js';

const mockEnv = {} as any;

function makeCtx(): SubmitCtx {
  return {
    formId: 'test',
    lang: 'en',
    fields: { name: 'John' },
    enriched: {},
    context: {
      ip: '127.0.0.1',
      userAgent: 'test',
      referrer: '',
      pageUrl: 'https://test.com',
      utm: {},
    },
  };
}

function makeSubmission(): Submission {
  return {
    ...makeCtx(),
    id: 'test-id',
    schemaVersion: 1,
    createdAt: Date.now(),
  };
}

describe('plugin-loader', () => {
  beforeEach(() => unregisterAll());

  it('registers and lists plugins', () => {
    const p: FormsPlugin = { name: 'p1', version: '1.0.0' };
    registerPlugin(p);
    expect(getRegisteredPlugins()).toHaveLength(1);
    expect(getRegisteredPlugins()[0]?.name).toBe('p1');
  });

  it('sorts plugins by priority (asc, default 100)', () => {
    registerPlugin({ name: 'late', version: '1.0.0', priority: 200 });
    registerPlugin({ name: 'early', version: '1.0.0', priority: 50 });
    registerPlugin({ name: 'default', version: '1.0.0' });
    const order = getRegisteredPlugins().map(p => p.name);
    expect(order).toEqual(['early', 'default', 'late']);
  });

  it('runs beforeValidate hooks in priority order, allows ctx mutation', async () => {
    registerPlugin({
      name: 'add-foo', version: '1.0.0', priority: 10,
      beforeValidate: (ctx) => ({ ...ctx, enriched: { ...ctx.enriched, foo: 1 } }),
    });
    registerPlugin({
      name: 'add-bar', version: '1.0.0', priority: 20,
      beforeValidate: (ctx) => ({ ...ctx, enriched: { ...ctx.enriched, bar: 2 } }),
    });
    const ctx = makeCtx();
    const result = await runHook('beforeValidate', ctx, mockEnv);
    expect((result as any).enriched).toEqual({ foo: 1, bar: 2 });
  });

  it('beforeValidate returning {reject} stops chain and propagates rejection', async () => {
    registerPlugin({
      name: 'rejector', version: '1.0.0', priority: 10,
      beforeValidate: () => ({ reject: 'spam detected', status: 400 }),
    });
    registerPlugin({
      name: 'should-not-run', version: '1.0.0', priority: 20,
      beforeValidate: (_ctx) => { throw new Error('should not run'); },
    });
    const result = await runHook('beforeValidate', makeCtx(), mockEnv);
    expect('reject' in result).toBe(true);
    if ('reject' in result) expect(result.reject).toBe('spam detected');
  });

  it('afterStore runs all plugins concurrently; one failure does not stop others', async () => {
    const ran: string[] = [];
    registerPlugin({
      name: 'plugin-fail', version: '1.0.0',
      afterStore: async () => { ran.push('fail'); throw new Error('boom'); },
    });
    registerPlugin({
      name: 'plugin-ok', version: '1.0.0',
      afterStore: async () => { ran.push('ok'); },
    });
    await runHook('afterStore', makeSubmission(), mockEnv);
    expect(ran.sort()).toEqual(['fail', 'ok']);
  });

  it('beforeRespond mutates response sequentially', async () => {
    registerPlugin({
      name: 'add-score', version: '1.0.0', priority: 10,
      beforeRespond: (resp) => ({ ...resp, score: 87 }),
    });
    registerPlugin({
      name: 'add-redirect', version: '1.0.0', priority: 20,
      beforeRespond: (resp) => ({ ...resp, redirectUrl: '/thanks' }),
    });
    const result = await runHook(
      'beforeRespond',
      { id: 'sub-1' },
      makeSubmission(),
      mockEnv,
    );
    expect(result).toEqual({ id: 'sub-1', score: 87, redirectUrl: '/thanks' });
  });
});
