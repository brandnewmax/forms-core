import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseHreflangs, discoverSiteLangs } from '../src/i18n-targets.js';

beforeEach(() => vi.restoreAllMocks());

const HTML = `<head>
  <link rel="alternate" hreflang="en" href="https://s/">
  <link rel="alternate" hreflang="es" href="https://s/es/">
  <link hreflang="fr" rel="alternate" href="https://s/fr/">
  <link rel="alternate" hreflang="ru" href="https://s/ru/">
  <link rel="alternate" hreflang="x-default" href="https://s/">
</head>`;

describe('parseHreflangs', () => {
  it('extracts target langs, dropping en and x-default, order preserved, deduped', () => {
    expect(parseHreflangs(HTML)).toEqual(['es', 'fr', 'ru']);
  });
  it('ignores hreflang on non-alternate links', () => {
    expect(parseHreflangs('<link rel="stylesheet" hreflang="es" href="x.css">')).toEqual([]);
  });
  it('returns [] when none present', () => {
    expect(parseHreflangs('<p>no links</p>')).toEqual([]);
  });
});

describe('discoverSiteLangs', () => {
  it('fetches the site url and parses hreflang', async () => {
    const spy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(new Response(HTML, { status: 200 }));
    expect(await discoverSiteLangs('https://s/')).toEqual(['es', 'fr', 'ru']);
    expect(spy.mock.calls[0]![0]).toBe('https://s/');
  });
  it('throws on non-ok', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(new Response('', { status: 500 }));
    await expect(discoverSiteLangs('https://s/')).rejects.toThrow('Site fetch 500');
  });
});
