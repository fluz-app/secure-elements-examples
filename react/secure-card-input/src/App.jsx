import { useEffect, useRef, useState } from "react";

// The SDK ships as a bundled browser global from Fluz's CDN, not as an
// installable npm package (see index.html's script tag and ../README.md),
// so it's read off `window` rather than imported.
const { renderFieldsForTokenization } = window.FluzSecureElements;

const FIELDS = ["pan", "expiry", "cvv"];

export default function App() {
  const containerRef = useRef(null);
  const inputsRef = useRef(null);

  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [declined, setDeclined] = useState(null);
  const [success, setSuccess] = useState(null);
  const [fieldState, setFieldState] = useState({
    pan: { isEmpty: true, isValid: false, isDirty: false },
    expiry: { isEmpty: true, isValid: false, isDirty: false },
    cvv: { isEmpty: true, isValid: false, isDirty: false },
  });
  const [submitting, setSubmitting] = useState(false);

  const [cardholderName, setCardholderName] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [country, setCountry] = useState("US");
  const [isBackupPayment, setIsBackupPayment] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function mintAndMount() {
      setStatus("requesting client token…");
      setError("");

      const response = await fetch("/mint-token").catch(() => null);
      if (!response) {
        if (!cancelled) {
          setStatus("failed");
          setError("mint-token request failed");
        }
        return;
      }

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (!cancelled) {
          setStatus("failed");
          setError(`mint-token failed (${response.status}): ${JSON.stringify(body)}`);
        }
        return;
      }
      if (cancelled) return;

      setStatus("mounting input fields…");

      // Mirrors docs/secure-card-input-guide.md exactly: one combined frame
      // holds pan/expiry/cvv together (brand-aware CVV validation needs the
      // frame to see the PAN field) -- it's mounted into a single container,
      // not one ref per field.
      const inputs = renderFieldsForTokenization({
        clientToken: body.clientToken,
        loadToken: body.loadToken,
        frameHostOrigin: body.frameHostOrigin,
        style: { fontFamily: "IBM Plex Mono", fontSize: "15px", color: "#111111" },
      });
      inputsRef.current = inputs;

      inputs.onChange((field, state) => {
        if (cancelled) return;
        setFieldState((prev) => ({ ...prev, [field]: state }));
      });

      inputs.onError((err) => {
        if (!cancelled) setError(`${err.code}: ${err.message}`);
      });

      inputs.onDeclined((decline) => {
        if (cancelled) return;
        setDeclined(decline);
        setSuccess(null);
        setSubmitting(false);
      });

      inputs.onSuccess((result) => {
        if (cancelled) return;
        setSuccess(result);
        setDeclined(null);
        setSubmitting(false);
      });

      try {
        await inputs.mount(containerRef.current);
        if (!cancelled) setStatus("mounted");
      } catch (err) {
        if (!cancelled) {
          setStatus("failed");
          setError(err && err.code ? `${err.code}: ${err.message}` : String(err));
        }
      }
    }

    mintAndMount();

    return () => {
      cancelled = true;
      inputsRef.current?.destroy();
      inputsRef.current = null;
    };
  }, []);

  const allFieldsValid = FIELDS.every((field) => fieldState[field].isValid);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!inputsRef.current) return;

    setError("");
    setDeclined(null);
    setSuccess(null);
    setSubmitting(true);

    // submit() resolves even on a decline or a backend error -- those arrive
    // via onDeclined/onSuccess above, not a rejection. The only things this
    // catch actually handles are the two programmer-error guard conditions
    // (submitting before mount() resolved, or while another submit() is
    // still in flight) -- see docs/secure-card-input-guide.md#submitting.
    try {
      await inputsRef.current.submit({
        cardholderName,
        billingAddress: {
          line1,
          city,
          state: region || undefined,
          zipCode,
          country,
        },
        isBackupPayment,
      });
    } catch (err) {
      setError(err && err.code ? `${err.code}: ${err.message}` : String(err));
      setSubmitting(false);
    }
  }

  const mounted = status === "mounted";

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 480, margin: "40px auto", padding: "0 16px", color: "#111" }}>
      <h1 style={{ fontSize: 18 }}>Fluz Secure Elements — Secure Card Input (React)</h1>
      <p>
        Loads the SDK from Fluz's CDN. Collects a card, cardholder name, and billing address, then registers it as a
        Fluz funding source — the PAN/CVV never touch this page's
        own JavaScript.
      </p>
      <p style={{ color: "#555" }}>Status: {status}</p>
      {error && <p style={{ color: "#b3261e" }}>{error}</p>}
      {declined && (
        <p style={{ color: "#9a5b00" }}>
          {declined.code}: {declined.message}
        </p>
      )}
      {success && (
        <p style={{ color: "#1f7a3d" }}>
          Added {success.brand} ending in {success.last4} (bankCardId: {success.bankCardId})
        </p>
      )}

      <form onSubmit={handleSubmit}>
        <FieldLabel htmlFor="card-fields">Card number, expiry, CVV</FieldLabel>
        <div
          ref={containerRef}
          id="card-fields"
          style={{ border: "1px solid #ccc", borderRadius: 4, padding: 8, minHeight: 20 }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          {FIELDS.map((field) => (
            <FieldStatus key={field} state={fieldState[field]} />
          ))}
        </div>

        <TextInput label="Cardholder name" autoComplete="cc-name" value={cardholderName} onChange={setCardholderName} required />
        <TextInput label="Address" autoComplete="address-line1" value={line1} onChange={setLine1} required />

        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <TextInput label="City" autoComplete="address-level2" value={city} onChange={setCity} required />
          </div>
          <div style={{ flex: 1 }}>
            <TextInput label="State" autoComplete="address-level1" value={region} onChange={setRegion} />
          </div>
          <div style={{ flex: 1 }}>
            <TextInput label="ZIP" autoComplete="postal-code" value={zipCode} onChange={setZipCode} required />
          </div>
        </div>

        <TextInput label="Country" autoComplete="country" value={country} onChange={setCountry} required />

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginTop: 12 }}>
          <input type="checkbox" checked={isBackupPayment} onChange={(event) => setIsBackupPayment(event.target.checked)} />
          Set as backup payment method
        </label>

        <button
          type="submit"
          disabled={!mounted || !allFieldsValid || submitting}
          style={{ font: "inherit", padding: "8px 16px", marginTop: 20, cursor: "pointer" }}
        >
          {submitting ? "Submitting…" : "Add card"}
        </button>
      </form>
    </main>
  );
}

function FieldLabel({ htmlFor, children }) {
  return (
    <label htmlFor={htmlFor} style={{ display: "block", fontSize: 13, fontWeight: 600, margin: "12px 0 4px" }}>
      {children}
    </label>
  );
}

function FieldStatus({ state }) {
  const isInvalid = state.isDirty && !state.isValid && !state.isEmpty;
  const text = isInvalid ? "invalid" : state.brand || "";
  return <div style={{ flex: 1, fontSize: 12, color: isInvalid ? "#b3261e" : "#666" }}>{text}</div>;
}

function TextInput({ label, value, onChange, autoComplete, required }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        type="text"
        value={value}
        autoComplete={autoComplete}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        style={{ font: "inherit", width: "100%", boxSizing: "border-box", padding: "7px 8px", border: "1px solid #ccc", borderRadius: 4 }}
      />
    </div>
  );
}
