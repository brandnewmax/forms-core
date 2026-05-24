import { factory as ulidFactory } from 'ulid';

// Use Web Crypto API (available in Workers + browser) instead of Node's crypto,
// so this runs correctly in both Cloudflare Workers (miniflare) and production.
const prng = () => crypto.getRandomValues(new Uint8Array(1))[0]! / 0xff;
const ulid = ulidFactory(prng);
import type { Env, SubmitCtx, Submission, SubmitResponse, ValidationError } from '../types.js';
import { runHook } from '../plugin-loader.js';
import { validateFields } from '../validation.js';
import { checkHoneypot, checkTimeOnForm, checkRateLimit } from '../anti-spam.js';
import { corsHeaders } from '../cors.js';
import { getLatestSchema, getFormSettings, insertSubmission } from '../db/queries.js';
import { sendSubmissionEmail } from '../email-forwarder.js';
import { dispatchWebhook, type WebhookConfig } from '../webhook-dispatcher.js';

interface RawSubmissionBody {
  fields?: Record<string, unknown>;
  context?: {
    page_url?: string;
    page_title?: string;
    lang?: string;
    referrer?: string;
    utm?: Record<string, string>;
    session_id?: string;
    first_seen_at?: number;
    viewport?: string;
    ua_brand?: string;
  };
  _meta?: {
    honeypot?: string;
    time_on_form_ms?: number;
  };
}

function jsonResponse(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

/**
 * Anything with a `waitUntil` method — CF Pages EventContext satisfies this
 * structurally without needing to import the type.
 */
interface WaitUntilCapable {
  waitUntil(promise: Promise<unknown>): void;
}

const MAX_BODY_BYTES = 65_536; // 64KB — generous for forms, blocks D1 row DoS

export async function handleSubmit(
  req: Request,
  env: Env,
  formId: string,
  execCtx?: WaitUntilCapable,
): Promise<Response> {
  const origin = req.headers.get('Origin');
  const cors = corsHeaders(origin, env.ALLOWED_ORIGINS);

  // Body size guard — reject before parsing so large payloads can't even land in memory
  const contentLength = parseInt(req.headers.get('content-length') ?? '0', 10);
  if (contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: 'Payload too large' }, 413, cors);
  }

  // 1. Parse body
  let body: RawSubmissionBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400, cors);
  }

  // 2. Load schema + settings
  const schema = await getLatestSchema(env.DB, formId);
  if (!schema) return jsonResponse({ error: 'Form not found' }, 404, cors);

  const settings = await getFormSettings(env.DB, formId);
  // spamMinTimeMs sourced from settings only (not FormSchema — single source of truth)
  const spamMinTimeMs = settings?.spamMinTimeMs ?? 3000;
  const rateLimit = settings?.rateLimitPerIp ?? 5;

  const ip = req.headers.get('cf-connecting-ip') ?? '0.0.0.0';

  // 3. Anti-spam pre-checks
  if (!checkHoneypot(body._meta?.honeypot)) {
    return jsonResponse({ error: 'Submission rejected' }, 400, cors);
  }
  if (!checkTimeOnForm(body._meta?.time_on_form_ms ?? 0, spamMinTimeMs)) {
    return jsonResponse({ error: 'Submission too fast' }, 400, cors);
  }
  if (!(await checkRateLimit(env.RATE_LIMIT_KV, ip, formId, rateLimit))) {
    return jsonResponse({ error: 'Too many requests' }, 429, cors);
  }

  // 4. Build SubmitCtx (server-trusted context fields — never trusts body for ip/country/ua)
  let ctx: SubmitCtx = {
    formId,
    lang: body.context?.lang ?? 'en',
    fields: body.fields ?? {},
    enriched: {},
    context: {
      ip,
      ipCountry: req.headers.get('cf-ipcountry') ?? undefined,
      userAgent: req.headers.get('user-agent') ?? '',
      referrer: body.context?.referrer ?? '',
      pageUrl: body.context?.page_url ?? '',
      utm: body.context?.utm ?? {},
      sessionId: body.context?.session_id,
      firstSeenAt: body.context?.first_seen_at,
    },
  };

  // 5. beforeValidate hook
  const beforeResult = await runHook('beforeValidate', ctx, env);
  if ('reject' in beforeResult) {
    return jsonResponse({ error: beforeResult.reject }, beforeResult.status ?? 400, cors);
  }
  ctx = beforeResult;

  // 6. Validation
  const errors: ValidationError[] = validateFields(schema, ctx.fields);
  await runHook('afterValidate', ctx, errors, env);
  if (errors.length > 0) {
    return jsonResponse({ errors }, 400, cors);
  }

  // 7. beforeStore hook (enrichment accumulation)
  ctx = await runHook('beforeStore', ctx, env);

  // 8. Persist to D1 with ULID
  const submission: Submission = {
    ...ctx,
    id: ulid(),
    schemaVersion: schema.version,
    createdAt: Date.now(),
  };
  await insertSubmission(env.DB, submission);

  // 9. afterStore: built-in email + webhook + plugin hooks (Pro)
  //    All concurrent + error-isolated. Use execCtx.waitUntil to offload.
  const afterStoreTasks: Promise<unknown>[] = [];

  // 9a. Built-in: email notification
  if (settings && settings.notifyEmails.length > 0) {
    afterStoreTasks.push(
      sendSubmissionEmail(submission, {
        toEmails: settings.notifyEmails,
        fromEmail: 'noreply@forms.mmldigi.com', // TODO Phase 1d: make tenant-configurable
        fromName: 'mmldigi forms',
        subject: `New inquiry — ${formId}`,
      }).catch(e => console.error('[email-forwarder] failed', e)),
    );
  }

  // 9b. Built-in: webhook dispatch
  const webhookCfgs = (settings?.webhooks ?? []) as WebhookConfig[];
  for (const cfg of webhookCfgs) {
    afterStoreTasks.push(
      dispatchWebhook(submission, cfg).catch(e => console.error(`[webhook:${cfg.id}] failed`, e)),
    );
  }

  // 9c. Plugin afterStore hooks (Pro plugins register here)
  afterStoreTasks.push(runHook('afterStore', submission, env));

  const afterStorePromise = Promise.all(afterStoreTasks);
  if (execCtx?.waitUntil) {
    execCtx.waitUntil(afterStorePromise);
  } else {
    await afterStorePromise;
  }

  // 10. beforeRespond hook (response mutation)
  let response: SubmitResponse = { id: submission.id };
  response = await runHook('beforeRespond', response, submission, env);

  return jsonResponse(response, 200, cors);
}
