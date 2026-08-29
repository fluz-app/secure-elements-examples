import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT ?? 4210);
const FRAME_HOST_ORIGIN = process.env.FRAME_HOST_ORIGIN ?? "https://staging.secure.fluz.app";
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  throw new Error("Missing required env var ACCESS_TOKEN (see .env.example)");
}

const PUBLIC_DIR = path.resolve(dirname, "public");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

async function serveFile(res, filePath) {
  try {
    const body = await readFile(filePath);
    res.writeHead(200, { "Content-Type": MIME_TYPES[path.extname(filePath)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
}

async function mintToken(res) {
  let upstream;
  try {
    upstream = await fetch(`${FRAME_HOST_ORIGIN}/v1/client-token`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ purpose: "tokenization" }),
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

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  if (url.pathname === "/mint-token") {
    return void mintToken(res);
  }
  return void serveFile(res, path.join(PUBLIC_DIR, url.pathname === "/" ? "index.html" : url.pathname));
});

server.listen(PORT, () => {
  console.log(`plain-html secure-card-input example listening on http://localhost:${PORT}`);
});
