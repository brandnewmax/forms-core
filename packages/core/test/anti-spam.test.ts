import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import {
  checkHoneypot,
  checkTimeOnForm,
  checkRateLimit,
} from '../src/anti-spam.js';

describe('checkHoneypot', () => {
  it('passes when honeypot is empty', () => {
    expect(checkHoneypot('')).toBe(true);
    expect(checkHoneypot(undefined)).toBe(true);
  });
  it('fails when honeypot has value (bot detected)', () => {
    expect(checkHoneypot('spam-bot-filled-this')).toBe(false);
  });
});

describe('checkTimeOnForm', () => {
  it('passes when ≥ minTimeMs', () => {
    expect(checkTimeOnForm(3500, 3000)).toBe(true);
    expect(checkTimeOnForm(3000, 3000)).toBe(true);
  });
  it('fails when < minTimeMs (too fast = bot)', () => {
    expect(checkTimeOnForm(500, 3000)).toBe(false);
  });
  it('passes when minTimeMs is 0 (disabled)', () => {
    expect(checkTimeOnForm(0, 0)).toBe(true);
  });
});

describe('checkRateLimit', () => {
  it('allows up to limit per minute, then blocks', async () => {
    const kv = env.RATE_LIMIT_KV;
    const ip = '1.2.3.4';
    const formId = 'contact';
    for (let i = 0; i < 5; i++) {
      expect(await checkRateLimit(kv, ip, formId, 5)).toBe(true);
    }
    expect(await checkRateLimit(kv, ip, formId, 5)).toBe(false);
  });

  it('different IPs have independent counts', async () => {
    const kv = env.RATE_LIMIT_KV;
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(kv, '5.5.5.5', 'contact', 5);
    }
    expect(await checkRateLimit(kv, '6.6.6.6', 'contact', 5)).toBe(true);
  });
});
