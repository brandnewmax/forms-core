import type {
  FormsPlugin,
  SubmitCtx,
  Submission,
  SubmitResponse,
  ValidationError,
  RejectSignal,
  Env,
} from './index.js';

const REGISTRY: FormsPlugin[] = [];

export function registerPlugin(plugin: FormsPlugin): void {
  REGISTRY.push(plugin);
  REGISTRY.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
}

export function unregisterAll(): void {
  REGISTRY.length = 0;
}

export function getRegisteredPlugins(): readonly FormsPlugin[] {
  return REGISTRY;
}

/**
 * Sequential hook with mutation chain. Returns final ctx or RejectSignal.
 */
async function runBeforeValidate(
  ctx: SubmitCtx,
  env: Env,
): Promise<SubmitCtx | RejectSignal> {
  let cur = ctx;
  for (const p of REGISTRY) {
    if (!p.beforeValidate) continue;
    const r = await p.beforeValidate(cur, env);
    if ('reject' in r) return r;
    cur = r;
  }
  return cur;
}

async function runAfterValidate(
  ctx: SubmitCtx,
  errors: ValidationError[],
  env: Env,
): Promise<void> {
  for (const p of REGISTRY) {
    if (!p.afterValidate) continue;
    try {
      await p.afterValidate(ctx, errors, env);
    } catch (e) {
      console.error(`[plugin:${p.name}] afterValidate failed`, e);
    }
  }
}

async function runBeforeStore(ctx: SubmitCtx, env: Env): Promise<SubmitCtx> {
  for (const p of REGISTRY) {
    if (!p.beforeStore) continue;
    const enrichedAdd = await p.beforeStore(ctx, env);
    ctx = { ...ctx, enriched: { ...ctx.enriched, ...enrichedAdd } };
  }
  return ctx;
}

/**
 * Concurrent + error-isolated. Each plugin failure logged but doesn't stop others.
 */
async function runAfterStore(submission: Submission, env: Env): Promise<void> {
  await Promise.all(
    REGISTRY.filter(p => p.afterStore).map(async p => {
      try {
        await p.afterStore!(submission, env);
      } catch (e) {
        console.error(`[plugin:${p.name}] afterStore failed`, e);
      }
    }),
  );
}

async function runBeforeRespond(
  response: SubmitResponse,
  submission: Submission,
  env: Env,
): Promise<SubmitResponse> {
  let cur = response;
  for (const p of REGISTRY) {
    if (!p.beforeRespond) continue;
    try {
      cur = await p.beforeRespond(cur, submission, env);
    } catch (e) {
      console.error(`[plugin:${p.name}] beforeRespond failed`, e);
    }
  }
  return cur;
}

/**
 * Generic dispatcher with typed overloads.
 */
export function runHook(
  name: 'beforeValidate',
  ctx: SubmitCtx,
  env: Env,
): Promise<SubmitCtx | RejectSignal>;
export function runHook(
  name: 'afterValidate',
  ctx: SubmitCtx,
  errors: ValidationError[],
  env: Env,
): Promise<void>;
export function runHook(
  name: 'beforeStore',
  ctx: SubmitCtx,
  env: Env,
): Promise<SubmitCtx>;
export function runHook(
  name: 'afterStore',
  submission: Submission,
  env: Env,
): Promise<void>;
export function runHook(
  name: 'beforeRespond',
  response: SubmitResponse,
  submission: Submission,
  env: Env,
): Promise<SubmitResponse>;
export function runHook(name: string, ...args: unknown[]): Promise<unknown> {
  switch (name) {
    case 'beforeValidate': return runBeforeValidate(args[0] as SubmitCtx, args[1] as Env);
    case 'afterValidate':  return runAfterValidate(args[0] as SubmitCtx, args[1] as ValidationError[], args[2] as Env);
    case 'beforeStore':    return runBeforeStore(args[0] as SubmitCtx, args[1] as Env);
    case 'afterStore':     return runAfterStore(args[0] as Submission, args[1] as Env);
    case 'beforeRespond':  return runBeforeRespond(args[0] as SubmitResponse, args[1] as Submission, args[2] as Env);
    default: throw new Error(`Unknown hook: ${name}`);
  }
}
