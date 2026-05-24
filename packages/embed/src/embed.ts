import { registerFormElement } from './form-element.js';

const CSS_FILES = ['structure.css', 'theme-default.css', 'theme/form-theme.css'];
const MARKER_ATTR = 'data-mf';

/**
 * Inject CSS link tags and register the Web Component. Idempotent —
 * safe to call multiple times.
 *
 * @param apiBase Origin where embed.js + CSS + API are served
 */
export function bootstrap(apiBase: string): void {
  injectStyles(apiBase);
  registerFormElement();
}

function injectStyles(apiBase: string): void {
  const existing = document.head.querySelectorAll(`link[${MARKER_ATTR}="true"]`);
  if (existing.length > 0) return;

  for (const file of CSS_FILES) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${apiBase}/${file}`;
    link.setAttribute(MARKER_ATTR, 'true');
    document.head.appendChild(link);
  }
}

/**
 * Auto-detect API base URL from the loading <script> tag's src origin.
 * Falls back to '' if not detectable (host site can pass explicit api-base
 * attribute on <mmldigi-form>).
 */
function detectApiBase(): string {
  const scripts = document.querySelectorAll<HTMLScriptElement>('script[src*="embed.js"]');
  const last = scripts[scripts.length - 1];
  if (last) {
    try { return new URL(last.src).origin; } catch { /* fall through */ }
  }
  return '';
}

// Auto-bootstrap on load (when embed.js is loaded via <script>)
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const apiBase = detectApiBase();
  if (apiBase) bootstrap(apiBase);
}
