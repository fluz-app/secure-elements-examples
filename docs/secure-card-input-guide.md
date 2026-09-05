# Fluz Secure Elements — Secure Card Input Guide

Secure Card Input collects a physical card from your user and adds it as a payment method on their Fluz account, without your page or servers ever seeing the cleartext PAN/CVV.

Before starting here, complete the shared setup in the **[Integration Guide](./partner-integration-guide.md)**: prerequisites, loading the SDK, and minting a client token with `"purpose": "tokenization"`. Minting that token requires the `MANAGE_PAYMENT` OAuth scope on the access token your backend exchanges it from — distinct from Card Reveal's `CREATE_VIRTUALCARD`. This page covers the input-specific frontend API only.

## Render the fields

`renderFieldsForTokenization` mounts **one combined frame** holding all three fields (pan, expiry, cvv) together — they aren't three separate elements you provide, and you can't mount them independently. That's a hard requirement, not a convenience: CVV validation is brand-aware (Amex needs 4 digits, everyone else needs 3), so the frame has to see the PAN field to validate the CVV field correctly.

```js
import { renderFieldsForTokenization } from "@fluz/secure-elements";

const inputs = renderFieldsForTokenization({
  clientToken,                                  // minted with purpose: "tokenization" -- never put this in a URL
  loadToken,                                    // short-lived; only authorizes the iframe GET, not collect/submit
  frameHostOrigin: "https://staging.secure.fluz.app",
});

await inputs.mount(document.getElementById("card-fields"));
```

### Options

| Option | Required | Description |
|---|---|---|
| `clientToken` | yes | Minted server-side with `purpose: "tokenization"`. Handed to the frame over `postMessage`, never the URL. |
| `loadToken` | yes | Minted alongside `clientToken`. Travels in the iframe's URL to authorize the initial load only — it cannot authorize a submit. |
| `frameHostOrigin` | no | One of `https://secure.fluz.app` (prod) or `https://staging.secure.fluz.app` (staging). Defaults to the prod origin. Anything else — including `localhost` outside a local SDK dev build — throws `INVALID_FRAME_HOST_ORIGIN` **synchronously from the `renderFieldsForTokenization(...)` call itself**, before you get an `inputs` object back — wrap that call in a try/catch too, not just `mount()`, if this value is ever configurable. |
| `mountId` | no | Custom id for the postMessage handshake. Only needed if you're mounting more than one `SecureInputs`/`CardViewer` instance on the same page and need to tell their messages apart; auto-generated otherwise. |
| `style` | no | `{ color?, fontSize?, fontFamily?, fontWeight? }`. See **[Styling fields](./partner-integration-guide.md#styling-fields)** for the validation rules — plus the collect-specific caveat below. |
| `mountTimeoutMs` | no | How long `mount()` waits for the frame's handshake before rejecting with `MOUNT_TIMEOUT`. Default `10000`. |
| `submitTimeoutMs` | no | How long `submit()` waits for a result before firing `onError({code: "SUBMIT_TIMEOUT"})`. Default `15000`. |
| `excludedCardBrands` | no | e.g. `["amex"]`. Brands you don't accept — the pan field reports `isValid: false` for a matching card instead of letting the user submit it. Detected brands: `"amex"`, `"visa"`, `"mastercard"`, `"discover"`, `"diners"`, `"jcb"`. |

### Styling caveat specific to card input

The general style rules and font allowlists are documented in the **[Integration Guide](./partner-integration-guide.md#styling-fields)**. One thing that guide doesn't cover because it's specific to this frame: in production, the three fields render inside a vendor (VGS) iframe that has no hook for loading external CSS. A Google Fonts `fontFamily` is silently skipped there — only a system font from the allowlist actually renders. If you need a custom webfont on this page, apply it to the labels/surrounding chrome you control instead of the field text itself.

## Field state — `onChange`

```js
inputs.onChange((field, state) => {
  // field: "pan" | "expiry" | "cvv"
  // state: { isEmpty: boolean, isValid: boolean, isDirty: boolean, brand?: string }
  // `brand` is only ever present on the "pan" field.
});
```

Fires on every keystroke in any of the three fields. Use it to drive your own submit-button enablement (`isValid` across all three fields) and inline validation messaging — the field's raw value is never exposed to your page.

## Submitting

Cardholder name and billing address are **not** framed — collect them as plain inputs on your own page (they aren't PCI-scoped) and pass them to `submit()`:

```js
await inputs.submit({
  cardholderName: "Jane Doe",
  billingAddress: {
    line1: "123 Main St",
    line2: "Apt 4",       // optional
    city: "Austin",
    state: "TX",          // optional
    zipCode: "78701",
    country: "US",
  },
  isBackupPayment: false, // optional
});
```

| Field | Notes |
|---|---|
| `cardholderName` | Split into first/last on the **first space only** — `"Mary Ann Smith"` becomes first name `"Mary"`, last name `"Ann Smith"`. A single-word name (no space) is used as both first and last name. |
| `billingAddress` | Either the object shown above, or `{ userAddressId: "<uuid>" }` to reuse an address already on the user's Fluz account instead of collecting one. `line1`/`city`/`zipCode`/`country` are required in the full form; `line2`/`state` are optional. |
| `isBackupPayment` | Optional. Marks the card as a backup funding source rather than primary. Omit or pass `false` for the normal case. |

`submit()` does **not** throw for a decline or a backend failure — it resolves in both cases, and the outcome arrives through the `onSuccess`/`onDeclined`/`onError` callbacks below. The only things that reject the `submit()` promise itself are programmer-error guard conditions: calling it before `mount()` resolves, or calling it again while a previous `submit()` is still in flight. If you want a single top-level `try/catch` for those, wrap the call, but you still need the callbacks for the actual result.

## Handling the result

```js
inputs.onSuccess((result) => {
  // result.bankCardId, result.brand, result.last4,
  // result.expirationMonth, result.expirationYear,
  // result.cardholderName, result.billingAddress, result.createdAt
});

inputs.onDeclined((decline) => {
  // decline.code, decline.message — show the user a friendly retry prompt.
  // decline.message is Fluz-owned canned copy, safe to show as-is or replace.
});

inputs.onError((error) => {
  // error instanceof FluzElementsError -- error.code, error.message
});
```

### Decline codes (`onDeclined`)

A decline means the card itself was rejected — not a bug in your integration. `decline.code` is one of:

| Code | Message |
|---|---|
| `CARD_DECLINED` | The card was declined. |
| `INSUFFICIENT_FUNDS` | The card was declined. |
| `CARD_EXPIRED` | This card has expired. |
| `CARD_INVALID` | This card could not be verified. |
| `CVV_MISMATCH` | The security code does not match the card. |
| `AVS_MISMATCH` | The billing address does not match the card. |
| `CONTACT_BANK` | The card was declined. Contact your card issuer. |
| `DUPLICATE_CARD` | This card has already been added. |
| `PREPAID_REJECTED` | Prepaid cards cannot be added. |
| `FRAUD_FILTER` | This card cannot be added. |
| `BIN_BLOCKED` | This card cannot be added. |
| `EXPANDED_BIN_REQUIRED` | This card cannot be added. |
| `KYB_GATE` | This account is not yet eligible to add a card. |
| `TRUST_STATUS_FAILED` | This account is not eligible to add a card. |
| `DEVICE_BLOCKED` | This device is not eligible to add a card. |
| `MAX_CARDS_REACHED` | The maximum number of cards has been reached. |
| `DECLINED_OTHER` | The card was declined. (fallback for any reason not in this list) |

Treat any code you don't recognize the same as `DECLINED_OTHER`. The raw gateway/processor response is never forwarded — `message` is always this canned copy.

### Errors (`onError` and rejected promises)

`error.code` is one of:

| Code | Fires from | Meaning |
|---|---|---|
| `MOUNT_TIMEOUT` | rejected `mount()` | The frame never completed its handshake within `mountTimeoutMs`. |
| `MOUNT_FAILED` | rejected `mount()` / `submit()` | The iframe failed to load, `mount()` was called twice, or `submit()` was called before `mount()` resolved. |
| `INVALID_STYLE` | rejected `mount()` | A `style` value failed validation — checked before anything is sent to the frame. |
| `INVALID_FRAME_HOST_ORIGIN` | thrown synchronously by `renderFieldsForTokenization(...)` itself, before `mount()` exists to call | `frameHostOrigin` isn't a valid URL or isn't an allowed Fluz host. |
| `FIELD_ERROR` | `onError` | The frame hit an internal error updating a field's state. Rare; treat as an unmountable session and re-mount. |
| `SUBMIT_TIMEOUT` | `onError` | No result arrived within `submitTimeoutMs`. The request may or may not have gone through server-side — don't assume either way; re-check via your backend before letting the user retry. |
| `SUBMIT_FAILED` | rejected `submit()` (guard conditions) or `onError` (everything else) | Catch-all. See below for how to read `error.message` in the `onError` case. |
| `RATE_LIMITED` | `onError` | Defined for the shared frame protocol but not currently triggered on this flow — a payment-method rate limit hit shows up as a generic `SUBMIT_FAILED` instead (see below). |

When `onError` fires with `code: "SUBMIT_FAILED"`, `error.message` carries the specific reason as a string, one of:

- `"VALIDATION_FAILED"` — submitted with an invalid/incomplete field; shouldn't happen if you gate your submit button on `onChange`'s `isValid` flags.
- `"COLLECT_UNAVAILABLE"` — this environment isn't fully provisioned for card collection yet. Not partner-actionable; contact Fluz.
- `"FUNDING_SOURCE_UNAUTHORIZED"` — Fluz's own backend-to-backend auth to the card-processing service failed. Not caused by anything in your request; safe to retry, but if it persists, contact Fluz.
- `"FUNDING_SOURCE_UNAVAILABLE"` — the card-processing backend returned an unexpected error (5xx, or a 4xx that wasn't a recognized decline). Safe to retry.
- `"SUBMIT_FAILED"` — a generic catch-all, including: the tokenization session itself is no longer valid (the client token or its underlying grant expired mid-session — this includes the OAuth access token your backend originally exchanged aging out, since that's re-checked at submit time), or a payment-method rate limit was hit. Since this string doesn't distinguish those cases, treat a `SUBMIT_FAILED` you get quickly after mount as likely rate-limiting (back off before retrying), and one after a long idle period as likely session expiry (mint a fresh client/load token pair and re-mount rather than retrying the same `submit()`).

## Cleanup

```js
inputs.destroy();
```

Removes the iframe and tears down its message listener. Call this on unmount/navigation, and before minting a fresh client token to re-render the fields (e.g. after a decline, if you want a clean session rather than resubmitting).

## Full example

```js
import { renderFieldsForTokenization } from "@fluz/secure-elements";

const inputs = renderFieldsForTokenization({
  clientToken,
  loadToken,
  frameHostOrigin: "https://staging.secure.fluz.app",
  excludedCardBrands: ["amex"],
  style: { fontFamily: "system-ui", fontSize: "16px", color: "#111" },
});

inputs.onChange((field, state) => updateFieldUi(field, state));
inputs.onDeclined((decline) => showRetryPrompt(decline.message));
inputs.onError((error) => showGenericError(error.code, error.message));
inputs.onSuccess((result) => showSavedCard(result));

await inputs.mount(document.getElementById("card-fields"));

submitButton.addEventListener("click", () => {
  inputs.submit({
    cardholderName: cardholderNameInput.value,
    billingAddress: { userAddressId: currentUser.defaultAddressId },
  });
});
```
