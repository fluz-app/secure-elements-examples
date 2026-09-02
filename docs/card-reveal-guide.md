# Fluz Secure Elements — Card Reveal Guide

Card Reveal displays a cardholder's full Fluz virtual card details (PAN, expiry, CVV) inside frames your page cannot read into.

Before starting here, complete the shared setup in the **[Integration Guide](./partner-integration-guide.md)**: prerequisites, loading the SDK, and minting a client token with `"purpose": "reveal"`. This page covers the reveal-specific frontend API only.

## Mount the viewer

```js
import { createCardViewer } from "@fluz/secure-elements";

const viewer = createCardViewer({
  clientToken,                                  // minted with purpose: "reveal" -- never put this in a URL
  loadToken,                                    // short-lived; only authorizes the iframe GET, not reveal/collect
  frameHostOrigin: "https://staging.secure.fluz.app",
  fields: [
    "pan",
    "expiry",
    { field: "cvv", individualReveal: false },  // opts this field out of reveal(field); still revealed by reveal()
  ],                                             // optional, defaults to all three with individualReveal: true
});

viewer.onError((error) => {
  // error.code / error.message
});

viewer.onMount(() => {
  // fires once every field has finished mounting — a good place to swap
  // a loading skeleton for the mounted viewer
});

await viewer.mount(document.getElementById("card-viewer"));

// Trigger the reveal for all fields at once (e.g. on a user's "Show card" click):
await viewer.reveal();

// Or trigger the reveal for just one field (e.g. a "Show CVV" button next to that field):
await viewer.reveal("pan");

// Optionally re-mask a field:
viewer.setMask("cvv", true);

// Or mask it and render nothing at all, if you'd rather show your own
// placeholder in your page instead of our default masked formatting:
viewer.setMask("cvv", true, { hidden: true });

// When you're done with it:
viewer.destroy();
```

The SDK creates and manages the frame(s) inside your container — you don't construct frame URLs or handle card data yourself. `reveal()` with no argument reveals every mounted field together; `reveal(field)` reveals just that one field, so you can offer a single "Show card" button, a "Show" button per field, or both at once.

To reveal just one field on its own (e.g. a "Show CVV" button next to that field), call `reveal(field)` — every field defaults to allowing this, so no config is needed for the common case. If a field should *never* be revealed on its own, and only ever appear as part of the whole-card `reveal()` call, opt it out with `{ field, individualReveal: false }` in `fields`: `reveal(field)` against an opted-out field then rejects with `FluzElementsError` (`code: "INDIVIDUAL_REVEAL_DISABLED"`) without contacting `frame-host`. Either way, `reveal()` with no argument always reveals every mounted field — `individualReveal` has no effect on it. This is a client-side integration choice, not a server-enforced capability — it controls what your own UI is allowed to trigger, not what data the grant can return.

Before `reveal()` is called, each field already shows a partial, non-sensitive default: the PAN field shows `•••• •••• •••• <last4>`, the expiry field shows the real expiry (not sensitive on its own), and the CVV field shows `•••`. Pass `{ hidden: true }` to `setMask()` if you'd rather show nothing at all and render your own placeholder in your page.

See the **[Integration Guide](./partner-integration-guide.md#styling-fields)** for styling these fields (color, font, weight, size).
