import { describe, it, expect, beforeEach } from 'vitest';
import { bootstrap } from '../src/embed.js';

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('bootstrap', () => {
  it('registers <mmldigi-form> custom element', () => {
    bootstrap('https://forms.x.com');
    expect(customElements.get('mmldigi-form')).toBeDefined();
  });

  it('injects 3 <link rel="stylesheet"> tags pointing at apiBase', () => {
    bootstrap('https://forms.x.com');
    const links = document.head.querySelectorAll('link[rel="stylesheet"][data-mf="true"]');
    expect(links).toHaveLength(3);
    const hrefs = [...links].map(l => l.getAttribute('href'));
    expect(hrefs).toContain('https://forms.x.com/structure.css');
    expect(hrefs).toContain('https://forms.x.com/theme-default.css');
  });

  it('is idempotent — calling twice does not double-inject', () => {
    bootstrap('https://forms.x.com');
    bootstrap('https://forms.x.com');
    const links = document.head.querySelectorAll('link[data-mf="true"]');
    expect(links).toHaveLength(3);
  });

  it('does not register custom element twice', () => {
    bootstrap('https://forms.x.com');
    expect(() => bootstrap('https://forms.x.com')).not.toThrow();
  });
});
