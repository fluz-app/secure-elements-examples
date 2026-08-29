import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? 4201);
const FRAME_HOST_ORIGIN = process.env.FRAME_HOST_ORIGIN ?? "https://staging.secure.fluz.app";
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const VIRTUAL_CARD_ID = process.env.VIRTUAL_CARD_ID;

if (!ACCESS_TOKEN) {
  throw new Error("Missing required env var ACCESS_TOKEN (see .env.example)");
}
if (!VIRTUAL_CARD_ID) {
  throw new Error("Missing required env var VIRTUAL_CARD_ID (see .env.example)");
}

async function mintToken(res) {
  let upstream;
  try {
    upstream = await fetch(`${FRAME_HOST_ORIGIN}/v1/client-token`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ purpose: "reveal", virtualCardId: VIRTUAL_CARD_ID }),
    });
  } catch {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "frame_host_unreachable" }));
    return;
  }

  const body = await upstream.json().catch(() => ({}));
  res.writeHead(upstream.status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(upstream.ok ? { ...body, frameHostOrigin: FRAME_HOST_ORIGIN } : body));
}

// Vite's dev server proxies /mint-token here (see vite.config.js) -- this
// process only ever mints tokens, it never serves the frontend itself. A
// real integration's backend usually looks like this: a small API endpoint
// alongside (or in front of) a separately-built frontend.
const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  if (url.pathname === "/mint-token") {
    return void mintToken(res);
  }
  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`react reveal example mint-token server listening on http://localhost:${PORT}`);
});
