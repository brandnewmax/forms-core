import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import {
  handleListForms, handleCreateForm,
  handleCreateSchemaVersion, handleGetSettings, handleUpdateSettings,
} from '../src/api-handlers/admin/forms.js';

const baseEnv = { ...env } as any;

beforeEach(async () => {
  await env.DB.exec(`DELETE FROM forms WHERE id != 'contact'`);
  await env.DB.exec(`DELETE FROM schema_versions WHERE form_id != 'contact'`);
  await env.DB.exec(`DELETE FROM forms_settings WHERE form_id != 'contact'`);
});

describe('handleListForms', () => {
  it('returns all forms with metadata', async () => {
    const resp = await handleListForms(new Request('https://x'), baseEnv);
    expect(resp.status).toBe(200);
    const body = await resp.json() as any;
    expect(Array.isArray(body)).toBe(true);
    expect(body.some((f: any) => f.id === 'contact')).toBe(true);
  });
});

describe('handleCreateForm', () => {
  it('creates new form + initializes default settings', async () => {
    const req = new Request('https://x', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'rfq', name: 'RFQ' }) });
    const resp = await handleCreateForm(req, baseEnv);
    expect(resp.status).toBe(201);
    const list = await env.DB.prepare(`SELECT id FROM forms WHERE id = 'rfq'`).first();
    expect(list).not.toBeNull();
    const sett = await env.DB.prepare(`SELECT form_id FROM forms_settings WHERE form_id = 'rfq'`).first();
    expect(sett).not.toBeNull();
  });

  it('returns 400 for missing id or name', async () => {
    const req = new Request('https://x', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const resp = await handleCreateForm(req, baseEnv);
    expect(resp.status).toBe(400);
  });
});

describe('handleCreateSchemaVersion', () => {
  it('inserts new version (auto-incremented) for existing form', async () => {
    const schemaJson = JSON.stringify({
      formId: 'contact', version: 99, submitButton: 'Send v2',
      fields: [{ name: 'name', type: 'text', label: 'Name' }],
    });
    const req = new Request('https://x', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: schemaJson });
    const resp = await handleCreateSchemaVersion(req, baseEnv, 'contact', 'admin@test');
    expect(resp.status).toBe(201);
    const body = await resp.json() as any;
    expect(body.version).toBeGreaterThan(1);
    const row = await env.DB.prepare(`SELECT version FROM schema_versions WHERE form_id = 'contact' ORDER BY version DESC LIMIT 1`).first<{ version: number }>();
    expect(row!.version).toBe(body.version);
  });
});

describe('handleGetSettings + handleUpdateSettings', () => {
  it('GET returns current settings', async () => {
    const resp = await handleGetSettings(new Request('https://x'), baseEnv, 'contact');
    expect(resp.status).toBe(200);
    const body = await resp.json() as any;
    expect(body.formId).toBe('contact');
    expect(body.spamMinTimeMs).toBe(3000);
  });

  it('PUT updates notify_emails + webhooks', async () => {
    const update = { notifyEmails: ['new@x.com'], webhooksJson: [{ id: 'w1', url: 'https://h', payload_template: 'raw' }] };
    const req = new Request('https://x', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(update) });
    const resp = await handleUpdateSettings(req, baseEnv, 'contact');
    expect(resp.status).toBe(204);
    const row = await env.DB.prepare(`SELECT notify_emails, webhooks_json FROM forms_settings WHERE form_id = 'contact'`).first<any>();
    expect(JSON.parse(row.notify_emails)).toEqual(['new@x.com']);
    expect(JSON.parse(row.webhooks_json)).toHaveLength(1);
  });
});
