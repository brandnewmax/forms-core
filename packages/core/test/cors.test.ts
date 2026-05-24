import { describe, it, expect } from 'vitest';
import { corsHeaders, handlePreflight, isOriginAllowed } from '../src/cors.js';

describe('isOriginAllowed', () => {
  it('matches exact origin in allowlist', () => {
    expect(isOriginAllowed('https://mmldigi.com', 'https://mmldigi.com,https://staging.mmldigi.com'))
      .toBe(true);
  });
  it('rejects origin not in allowlist', () => {
    expect(isOriginAllowed('https://evil.com', 'https://mmldigi.com')).toBe(false);
  });
  it('handles whitespace in allowlist', () => {
    expect(isOriginAllowed('https://a.com', '  https://a.com , https://b.com  ')).toBe(true);
  });
  it('wildcard "*" allows any origin', () => {
    expect(isOriginAllowed('https://anything.com', '*')).toBe(true);
  });
});

describe('corsHeaders', () => {
  it('returns Access-Control-Allow-Origin for allowed origin', () => {
    const h = corsHeaders('https://mmldigi.com', 'https://mmldigi.com');
    expect(h['Access-Control-Allow-Origin']).toBe('https://mmldigi.com');
  });
  it('returns no Origin header for disallowed origin', () => {
    const h = corsHeaders('https://evil.com', 'https://mmldigi.com');
    expect(h['Access-Control-Allow-Origin']).toBeUndefined();
  });
});

describe('handlePreflight', () => {
  it('returns 204 with CORS headers for OPTIONS', () => {
    const req = new Request('https://api.test.com', {
      method: 'OPTIONS',
      headers: { Origin: 'https://mmldigi.com', 'Access-Control-Request-Method': 'POST' },
    });
    const resp = handlePreflight(req, 'https://mmldigi.com');
    expect(resp.status).toBe(204);
    expect(resp.headers.get('Access-Control-Allow-Origin')).toBe('https://mmldigi.com');
  });
});
