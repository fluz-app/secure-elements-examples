# Fluz Secure Elements — Integration Guide

Fluz Secure Elements lets you embed two card capabilities directly in your web app without card data ever passing through your servers or being readable by your frontend code:

- **[Card Reveal](./card-reveal-guide.md)** — display a cardholder's full Fluz virtual card details (PAN, CVV, expiry).
- **[Secure Card Input](./secure-card-input-guide.md)** — collect a physical card from your user and add it as a payment method on their Fluz account.

Both are delivered as isolated frames rendered by Fluz and mounted into your page by our JS SDK. Card data lives only inside those frames — your page and servers only ever see a short-lived, opaque token.

This guide covers what's shared by both capabilities — minting a client token, loading the SDK, styling fields, and CSP/security. Once you've read this, continue to whichever capability guide you need.

## How it works

1. **Your backend** exchanges your existing Fluz OAuth access token for a short-lived **client token**, scoped to a single user action (one reveal, or one card-add).
2. **Your frontend** hands that client token to the `@fluz/secure-elements` SDK, which mounts the Fluz-hosted frame(s) into a container you provide.
3. The SDK reports results back to your page via callbacks — success, decline, or error — without ever exposing raw card data to your code.

```
Your backend  → mint client token  → Your frontend → SDK mounts Fluz frame(s) → callback with result
```

## Prerequisites

Before you can integrate, please confirm the following with your Fluz integration contact:

- Your application is registered with Fluz and has the `CREATE_VIRTUALCARD` OAuth scope enabled.
- The origin(s) your page will embed Fluz Elements from are allow-listed for your application (required for the frames to render — this is a one-time setup step on our side).
- You've received your environment base URL(s) (see **Environments** below).

## Environments

| Environment | Base URL |
|---|---|
| Staging | `https://staging.secure.fluz.app` |
| Production | `https://secure.fluz.app` |

> **Staging note:** reveal and card-add currently return simulated results on staging while our processor integration is finalized. Use staging to validate your integration end-to-end; production availability will be confirmed separately.

## Loading the SDK

Install `@fluz/secure-elements` and import it like any other package:

```js
import { createCardViewer, renderFieldsForTokenization } from "@fluz/secure-elements";
```

If you're not using a bundler, the same package also ships a browser global (IIFE) build served from our CDN, exposing a `FluzSecureElements` global. Load it via a `<script src>` tag, then call the same functions off the global:

```html
<script src="https://secure-cdn-staging.fluz.app/secure-elements/v0.1.0/index.global.js"></script>
<script>
  const viewer = FluzSecureElements.createCardViewer({ /* ... */ });
</script>
```

**Pinning vs. floating:** each release is published to an immutable, version-pinned path (`.../v<major.minor.patch>/index.global.js`) as well as a floating `.../latest/index.global.js` that always points at the newest release. Pin to a specific version for production integrations — `latest` is convenient for prototyping but can change under you without notice.

> Staging note: only a staging CDN host is live so far (`secure-cdn-staging.fluz.app`); production hosting will be confirmed alongside production API availability.

## Step 1 — Mint a client token (server-side)

Your backend calls this using the OAuth access token you already obtain through Fluz's standard OAuth flow. **Never send that access token to the browser** — only the `clientToken`/`loadToken` pair it returns should reach your frontend.

```
POST {baseUrl}/v1/client-token
Authorization: Bearer <your Fluz OAuth access token>
Content-Type: application/json

{
  "purpose": "reveal",          // or "tokenization" for Secure Card Input
  "virtualCardId": "<uuid>"     // required when purpose is "reveal"
}
```

**Response**
```json
{ "clientToken": "<token>", "loadToken": "<token>", "expiresIn": 300 }
```

Both are single-purpose and short-lived — mint a new pair for each reveal or card-add action. Pass both straight into the SDK (see below); `clientToken` is the one that authorizes reveal/collect, `loadToken` only authorizes loading the field frames and is rejected everywhere else. Never send either one anywhere but your own frontend — and never put `clientToken` in a URL yourself, the SDK already keeps it out of one.

<details>
<summary>Error responses</summary>

| Status | Error | Meaning |
|---|---|---|
| 400 | `invalid_purpose` | `purpose` missing or invalid |
| 400 | `virtual_card_id_required` | missing `virtualCardId` for a reveal token |
| 401 | `unauthorized` | invalid or missing access token |
| 403 | `insufficient_scope` | access token missing `CREATE_VIRTUALCARD` scope |
| 403 | `app_not_registered` | your application isn't registered — contact Fluz |
| 403 | `forbidden` | card not found, or not owned by this user |
| 500 | `internal_error` | unexpected server error |

</details>

With a client token in hand, continue to the **[Card Reveal guide](./card-reveal-guide.md)** or the **[Secure Card Input guide](./secure-card-input-guide.md)**.

## Styling fields

Both `createCardViewer` and `renderFieldsForTokenization` accept an optional `style` object, applied to every field they mount:

```js
const viewer = createCardViewer({
  clientToken,
  loadToken,
  frameHostOrigin: "https://staging.secure.fluz.app",
  style: {
    color: "#1a1a1a",
    fontSize: "16px",
    fontWeight: "600",
    fontFamily: "Inter", // any Google Font, or a system font -- see below
  },
});
```

`style` is validated before anything is sent to the frame — if a value doesn't match what's documented below, `await viewer.mount(...)` (or `await inputs.mount(...)`) rejects with a `FluzElementsError` (`error.code === "INVALID_STYLE"`), so wrap your `mount()` call in a try/catch if you're accepting configurable style input yourself.

| Property | Accepts |
|---|---|
| `color` | A hex color (`#1a1a1a` or `#111`), an `rgb(r, g, b)` value, or a CSS named color (`"slategray"`) |
| `fontSize` | A number followed by `px`, `pt`, `em`, or `rem` (e.g. `"16px"`) |
| `fontWeight` | `"normal"`, `"bold"`, or a multiple of 100 from `"100"` to `"900"` |
| `fontFamily` | An exact system font name or Google Font family name — see below |

### Fonts

`fontFamily` must be an **exact match** for one of two allowlists — anything else is rejected rather than silently ignored:

- **System fonts** — common OS/web-safe stacks: `system-ui`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Helvetica Neue`, `Helvetica`, `Arial`, `Verdana`, `Tahoma`, `Trebuchet MS`, `Georgia`, `Times New Roman`, `Times`, `Courier New`, `Menlo`, `Consolas`, and the generic keywords `monospace`, `serif`, `sans-serif`, `cursive`, `fantasy`. These render immediately — no network request.
- **Google Fonts** — any family from the full Google Fonts catalog (e.g. `"Roboto"`, `"Inter"`, `"Playfair Display"`, `"IBM Plex Mono"`). Pass the family name exactly as Google lists it. The SDK loads the font for you — you don't need to add a `<link>` or `@font-face` rule yourself, and it works even if your own page has never loaded that font.

> **Flash of unstyled text:** a Google Font is fetched from `fonts.googleapis.com`/`fonts.gstatic.com` after the field mounts, not bundled up front — so there's a brief window where the field renders in the browser's fallback font before swapping to your chosen one once it downloads. This is normally only noticeable on a cold cache. A system font has no such delay, since it's already installed locally.

Both lists are exported from the SDK if you want to validate or offer a font picker yourself:

```js
import { SYSTEM_FONTS, GOOGLE_FONTS, isAllowedFontFamily } from "@fluz/secure-elements";

isAllowedFontFamily("Roboto"); // true
isAllowedFontFamily("roboto"); // false -- exact, case-sensitive match required
```

## Content Security Policy

If your page sets a CSP, add:

```
frame-src https://staging.secure.fluz.app;   # or https://secure.fluz.app in production
```

## Security model

- Your OAuth access token never leaves your servers.
- The client token your frontend holds is opaque and single-purpose — it carries no card data and can't be replayed for a different card or action.
- Card data is only ever readable inside the Fluz-hosted frames, isolated from your page's own JavaScript.
- Frames only render inside origins you've pre-registered with Fluz.

## Support

Contact your Fluz integration contact for staging/production credentials, origin allow-listing, or integration questions.
