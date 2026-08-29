import { useEffect, useRef, useState } from "react";

// The SDK ships as a bundled browser global from Fluz's CDN, not as an
// installable npm package (see index.html's script tag and ../README.md),
// so it's read off `window` rather than imported.
const { createCardViewer } = window.FluzSecureElements;

const FIELDS = ["pan", "expiry", "cvv"];

export default function App() {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

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

      setStatus("mounting card viewer…");

      // Mirrors docs/card-reveal-guide.md exactly.
      const viewer = createCardViewer({
        clientToken: body.clientToken,
        loadToken: body.loadToken,
        frameHostOrigin: body.frameHostOrigin,
        fields: FIELDS,
        style: { fontFamily: "IBM Plex Mono", fontSize: "16px", color: "#111111" },
      });
      viewerRef.current = viewer;

      viewer.onError((err) => {
        if (!cancelled) setError(`${err.code}: ${err.message}`);
      });

      viewer.onMount(() => {
        if (!cancelled) setStatus("mounted");
      });

      try {
        await viewer.mount(containerRef.current);
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
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
  }, []);

  async function handleReveal() {
    try {
      await viewerRef.current?.reveal();
    } catch (err) {
      setError(err && err.code ? `${err.code}: ${err.message}` : String(err));
    }
  }

  function handleMask() {
    FIELDS.forEach((field) => viewerRef.current?.setMask(field, true));
  }

  const mounted = status === "mounted";

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 480, margin: "40px auto", padding: "0 16px", color: "#111" }}>
      <h1 style={{ fontSize: 18 }}>Fluz Secure Elements — Card Reveal (React)</h1>
      <p>
        Loads the SDK from Fluz's CDN and mounts a <code>CardViewer</code> against a real{" "}
        <code>frame-host</code>.
      </p>
      <p style={{ color: "#555" }}>Status: {status}</p>
      {error && <p style={{ color: "#b3261e" }}>{error}</p>}
      <div
        ref={containerRef}
        style={{ display: "flex", gap: 12, minHeight: 40, margin: "16px 0", border: "1px dashed #ccc", padding: 12 }}
      />
      <button type="button" onClick={handleReveal} disabled={!mounted} style={{ font: "inherit", padding: "6px 12px", marginRight: 8 }}>
        Reveal
      </button>
      <button type="button" onClick={handleMask} disabled={!mounted} style={{ font: "inherit", padding: "6px 12px" }}>
        Mask again
      </button>
    </main>
  );
}
