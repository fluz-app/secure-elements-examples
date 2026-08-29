# Examples

Four runnable integrations of `@fluz/secure-elements`, one per combination of integration style and capability:

|                    | Card Reveal | Secure Card Input |
|--------------------|-------------|--------------------|
| Plain HTML (`<script src>`) | [`plain-html/reveal`](./plain-html/reveal) | [`plain-html/secure-card-input`](./plain-html/secure-card-input) |
| React (`window` global)     | [`react/reveal`](./react/reveal) | [`react/secure-card-input`](./react/secure-card-input) |

Each example is self-contained — its own `package.json`, no shared code — so you can copy any one of them out of this repo as a starting point. None of them depend on anything else in this repo at runtime: the SDK loads from Fluz's CDN (`secure-cdn-staging.fluz.app`), the same way any partner's page would, since `@fluz/secure-elements` is only ever published as a bundled CDN artifact — it isn't an installable npm package. The React examples read it off `window.FluzSecureElements` for that reason (see each `index.html`'s script tag).

Read the **[Integration Guide](../docs/partner-integration-guide.md)** first; each example implements exactly the API documented there and in the [Card Reveal guide](../docs/card-reveal-guide.md) / [Secure Card Input guide](../docs/secure-card-input-guide.md). Nothing here is a simplified or fake version of the flow — every example calls Fluz's real staging `frame-host` with a real client token.

## Prerequisites

1. Confirm with your Fluz integration contact that your test application has the `CREATE_VIRTUALCARD` OAuth scope enabled, and that the example's origin is allow-listed for Elements — `http://localhost:4200` / `:4210` for the plain-HTML examples, `http://localhost:5173` / `:5174` for the React ones (see each example's `.env.example`).
2. **A real Fluz OAuth access token** with that scope, and — for the reveal examples — an `ACTIVE` virtual card id owned by the same account. Each example reads these from its own `.env` (`ACCESS_TOKEN`, `VIRTUAL_CARD_ID`) — copy `.env.example` to `.env` and fill them in. Never commit a real token; `.env` is gitignored.

Everything runs against **staging**, not a local `frame-host` — see the integration guide's Environments section. Staging currently returns simulated reveal/card-add results while Fluz's processor integration is finalized, so nothing here touches a real card, but every request is a real HTTP call through real infrastructure — nothing in these examples is a local fake or in-memory stand-in.

## Running one

```bash
cd examples/plain-html/reveal   # or any of the other three
npm install
cp .env.example .env            # then fill in ACCESS_TOKEN (and VIRTUAL_CARD_ID for reveal)
npm run dev                     # plain-html examples: one command
```

The React examples split the mint-token backend from the Vite dev server (a real partner integration usually does too — a Node/Express backend and a separately-built frontend), so they need two terminals:

```bash
cd examples/react/reveal
npm install
cp .env.example .env
npm run server   # terminal 1 — mints client tokens
npm run dev      # terminal 2 — Vite dev server on http://localhost:5173
```
