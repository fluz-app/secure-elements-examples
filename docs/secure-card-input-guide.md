# Fluz Secure Elements — Secure Card Input Guide

Secure Card Input collects a physical card from your user and adds it as a payment method on their Fluz account, without your page or servers ever seeing the cleartext PAN/CVV.

Before starting here, complete the shared setup in the **[Integration Guide](./partner-integration-guide.md)**: prerequisites, loading the SDK, and minting a client token with `"purpose": "tokenization"`. This page covers the input-specific frontend API only.

## Render and submit the fields

```js
import { renderFieldsForTokenization } from "@fluz/secure-elements";

const inputs = renderFieldsForTokenization({
  clientToken,                                  // minted with purpose: "tokenization" -- never put this in a URL
  loadToken,                                    // short-lived; only authorizes the iframe GET, not collect/submit
  frameHostOrigin: "https://staging.secure.fluz.app",
});

inputs.onChange((field, state) => {
  // field: "pan" | "expiry" | "cvv"
  // state: { isEmpty, isValid, isDirty, brand }
});

inputs.onError((error) => { /* ... */ });
inputs.onDeclined((decline) => {
  // decline.code, decline.message — show the user a friendly retry prompt
});
inputs.onSuccess((result) => {
  // result.bankCardId, result.brand, result.last4, ...
});

await inputs.mount({
  pan: document.getElementById("pan-field"),
  expiry: document.getElementById("expiry-field"),
  cvv: document.getElementById("cvv-field"),
});

// Once the user has filled in all fields and clicked submit:
await inputs.submit({
  cardholderName: "Jane Doe",
  billingAddress: {
    line1: "123 Main St",
    city: "Austin",
    state: "TX",
    zipCode: "78701",
    country: "US",
  },
});
```

**Decline codes** you may see via `onDeclined`: `CARD_DECLINED`, `CARD_EXPIRED`, `CARD_INVALID`, `CVV_MISMATCH`, `AVS_MISMATCH`, `INSUFFICIENT_FUNDS`, `DUPLICATE_CARD`, `FRAUD_FILTER`, `CONTACT_BANK`, `MAX_CARDS_REACHED`, and others — treat any unrecognized code as a generic "card couldn't be added" message.

See the **[Integration Guide](./partner-integration-guide.md#styling-fields)** for styling these fields (color, font, weight, size).
