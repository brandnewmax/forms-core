# Form Theme CSS Generator

You are a senior product designer + frontend engineer. Your task: generate a
`theme.css` file for the mmldigi-forms widget so it feels visually native to
the host site — not like an embedded third-party widget.

## Inputs

### 1. Host site
- URL: {{HOST_SITE_URL}}
- Brand / tone: {{BRAND_DESCRIPTION}}
- Host design tokens CSS (if available):
{{HOST_TOKENS_CSS}}

### 2. Visual reference
- Screenshot of homepage hero / main content sections:
{{SCREENSHOT_PATHS}}
- Host CSS `:root` variables (grep + paste):
{{HOST_ROOT_VARS}}

### 3. Special instructions (optional)
{{SPECIAL_NOTES}}

## Output contract (MUST follow)

1. **Output ONE CSS file** with a single `:root { ... }` block.
2. **Assign ONLY these 30 variables** (from `tokens-spec.css`):
   - Colors (12): `--mf-color-bg`, `--mf-color-surface`, `--mf-color-surface-hover`,
     `--mf-color-border`, `--mf-color-border-focus`, `--mf-color-text`,
     `--mf-color-text-muted`, `--mf-color-text-on-accent`, `--mf-color-accent`,
     `--mf-color-accent-hover`, `--mf-color-error`, `--mf-color-success`
   - Typography (7): `--mf-font-family`, `--mf-font-family-mono`,
     `--mf-font-size-label`, `--mf-font-size-input`, `--mf-font-weight-label`,
     `--mf-label-uppercase`, `--mf-label-letter-spacing`
   - Shape (3): `--mf-radius-input`, `--mf-radius-button`, `--mf-border-width`
   - Spacing (4): `--mf-spacing-field`, `--mf-spacing-input-x`,
     `--mf-spacing-input-y`, `--mf-spacing-section`
   - Interaction (3): `--mf-transition`, `--mf-focus-ring`, `--mf-shadow-input`
   - Reserved (1): `--mf-reserved-future-1` (set to `initial`)
3. **Reference host CSS vars when possible** — e.g.
   `--mf-color-accent: var(--accent, #C5FF50);`
   so future brand-color changes in the host site propagate to the form.
4. **a11y constraints**:
   - Body text vs background contrast ≥ 4.5:1
   - Focus border vs background ≥ 3:1
   - Don't remove outline without `box-shadow` replacement
   - Input font-size ≥ 16px (prevents iOS Safari zoom on focus)
5. **No external font imports** — use host's font stack (typically already loaded).
6. **No `!important`**, no class definitions, no selectors except `:root` and
   `@media (prefers-color-scheme: light) { :root { ... } }` (optional).

## Design heuristics

- **Dark vs light theme**: look at the host's body background. If ≥ 50% gray
  intensity → dark mode.
- **Border radius**: match the host's button/card radii within ±2px.
- **Accent color usage**: limit to (1) primary CTA button, (2) focus rings,
  (3) progress indicators. Don't sprinkle accent across all labels/borders.
- **Dark theme pitfalls**: avoid pure `#000` (looks cheap); avoid pure white
  body text (harsh — prefer `#F4F4F7` or similar).
- **Label style for industrial B2B**: mono font + small caps + letter-spacing
  reads as "engineering / serious / precise".

## Example output (good)

```css
/* theme generated for mmldigi.com on 2026-05-24 */
/* dark theme, inherits host --accent + --font-sans for live brand sync */
:root {
  --mf-color-bg:             var(--bg, #0A0B0E);
  --mf-color-surface:        var(--surface-1, #14161A);
  --mf-color-surface-hover:  var(--surface-2, #1D2025);
  --mf-color-border:         var(--border, #2A2D33);
  --mf-color-border-focus:   var(--accent, #C5FF50);
  --mf-color-text:           var(--text-primary, #F4F4F7);
  --mf-color-text-muted:     var(--text-muted, #6B6F7A);
  --mf-color-text-on-accent: #0A0B0E;
  --mf-color-accent:         var(--accent, #C5FF50);
  --mf-color-accent-hover:   #D4FF7A;
  --mf-color-error:          #FF6B6B;
  --mf-color-success:        var(--accent, #C5FF50);

  --mf-font-family:           var(--font-sans, 'Inter', sans-serif);
  --mf-font-family-mono:      var(--font-mono, 'JetBrains Mono', monospace);
  --mf-font-size-label:       11px;
  --mf-font-size-input:       16px;
  --mf-font-weight-label:     500;
  --mf-label-uppercase:       uppercase;
  --mf-label-letter-spacing:  0.12em;

  --mf-radius-input:  8px;
  --mf-radius-button: 999px;
  --mf-border-width:  1px;

  --mf-spacing-field:   20px;
  --mf-spacing-input-x: 16px;
  --mf-spacing-input-y: 14px;
  --mf-spacing-section: 32px;

  --mf-transition:   all 0.15s ease;
  --mf-focus-ring:   0 0 0 3px rgba(197, 255, 80, 0.25);
  --mf-shadow-input: none;

  --mf-reserved-future-1: initial;
}
```

## Self-check

Before delivering, verify:
- [ ] All 30 variables assigned (no missing → won't fall back to theme-default
      since this file LOADS AFTER theme-default, missing vars stay at default)
- [ ] focus state visible (border-color OR box-shadow change on `:focus`)
- [ ] mobile input ≥ 16px
- [ ] `var(--xxx, fallback)` used wherever host has a corresponding token
