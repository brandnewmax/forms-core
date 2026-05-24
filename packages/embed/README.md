# @mmldigi/forms-embed

Embeddable form widget for mmldigi-forms. One `<script>` + one `<mmldigi-form>`
element and your site has a working B2B inquiry form.

## Quick start

In your site's `<head>`:
```html
<script src="https://forms.{your-tenant}.com/embed.js" defer></script>
```

Then place the form anywhere on the page:
```html
<mmldigi-form form-id="contact"></mmldigi-form>
```

That's it. The widget will:
1. Fetch the form schema from `https://forms.{your-tenant}.com/api/v1/forms/contact/schema`
2. Render the form using the host site's CSS variables (auto-themes)
3. Submit to `https://forms.{your-tenant}.com/api/v1/forms/contact/submissions`
4. Dispatch lifecycle events you can hook into GTM

## Element attributes

| Attribute | Required | Default | Description |
|---|---|---|---|
| `form-id` | ✅ | — | Form ID registered on the backend |
| `lang` | — | `<html lang>` or `en` | Locale for label translations |
| `api-base` | — | auto-detected from `embed.js` src | Override the API origin |
| `prefill` | — | — | JSON string with field default values |

Example with all options:
```html
<mmldigi-form
  form-id="discovery-call"
  lang="en"
  api-base="https://forms.mmldigi.com"
  prefill='{"company":"Acme Inc"}'
></mmldigi-form>
```

## Lifecycle events for GTM

Attach a single listener; branch on `e.detail.type`:

```javascript
window.addEventListener('mmldigi-form-event', (e) => {
  const { type, formId, submissionId, score, fieldName, errors } = e.detail;
  window.dataLayer?.push({
    event: `form_${type}`,
    form_id: formId,
    value: GTM_VALUES[type],
    score, submissionId,
  });
});
```

| event.type | When | Detail extras |
|---|---|---|
| `view` | Form first enters viewport (mounts) | — |
| `start` | User focuses any field for the first time | — |
| `field_complete` | User leaves a non-empty field | `fieldName` |
| `submit_attempt` | Submit clicked but validation failed | `errors[]` |
| `submit_success` | Backend stored the submission | `submissionId`, `score?` |
| `scored` | Lead scoring API returned a score (Pro) | `submissionId`, `score` |
| `qualified` | Score ≥ threshold (Pro) | `submissionId`, `score` |

## Theming

The form uses 30 CSS variables (see `src/styles/tokens-spec.css`). By default
it inherits your site's `--accent`, `--bg`, `--text-primary`, `--font-sans`,
etc., so a plain `<mmldigi-form>` on a dark site looks dark, on a light site
looks light.

For tenant-specific theming, place a `theme/form-theme.css` file in the deploy
that overrides any of the 30 `--mf-*` tokens. See `tools/theme-prompt-template.md`
for an AI-assisted way to generate that file from your existing brand tokens.

## Browser support

Modern browsers (ES2020 + Custom Elements v1 + IntersectionObserver). Safari 14+,
Chrome 90+, Firefox 90+, Edge 90+. No IE11.
