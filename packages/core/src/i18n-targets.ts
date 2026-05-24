/** Parse <link rel="alternate" hreflang="xx"> tags; return target langs (drops en + x-default), order-preserved, deduped. */
export function parseHreflangs(html: string): string[] {
  const langs: string[] = [];
  const linkTag = /<link\b[^>]*\brel=["']alternate["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkTag.exec(html))) {
    const tag = m[0];
    if (!tag) continue;
    const hl = /\bhreflang=["']([a-zA-Z-]+)["']/i.exec(tag);
    if (!hl) continue;
    const rawCode = hl[1];
    if (!rawCode) continue;
    const code = rawCode.toLowerCase();
    if (code === 'en' || code === 'x-default') continue;
    if (!langs.includes(code)) langs.push(code);
  }
  return langs;
}

/** Fetch the host site root and discover its target languages from hreflang. */
export async function discoverSiteLangs(siteUrl: string): Promise<string[]> {
  const resp = await fetch(siteUrl, { headers: { Accept: 'text/html' } });
  if (!resp.ok) throw new Error(`Site fetch ${resp.status}`);
  return parseHreflangs(await resp.text());
}
