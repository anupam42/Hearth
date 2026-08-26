import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { cpSync, mkdirSync } from "node:fs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, "dist");
const port = process.env.PORT ?? 5173;
const apiTarget = process.env.API_TARGET ?? "http://localhost:8080";
const liveReload = process.env.LIVE_RELOAD !== "0";

const mimeTypes = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".map": "application/json",
  ".json": "application/json",
};

/** Server-sent-events clients waiting for a reload signal. */
const reloadClients = new Set();

function broadcastReload() {
  for (const res of reloadClients) {
    res.write("event: reload\ndata: reload\n\n");
  }
}

const LIVE_RELOAD_SCRIPT = `
<script>
  (() => {
    const es = new EventSource("/__livereload");
    es.addEventListener("reload", () => location.reload());
    es.onerror = () => { es.close(); setTimeout(() => location.reload(), 1000); };
  })();
</script>`;

function copyAssets() {
  mkdirSync(dist, { recursive: true });
  cpSync(path.join(root, "public"), dist, { recursive: true });
  cpSync(path.join(root, "src", "styles"), path.join(dist, "styles"), {
    recursive: true,
    filter: (src) => !src.endsWith(".ts"),
  });
}

copyAssets();

function debounce(fn, ms) {
  let timer = null;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}

if (liveReload) {
  // Recompile on TypeScript changes.
  const tsc = spawn("npx", ["tsc", "--watch", "--preserveWatchOutput"], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  process.on("exit", () => tsc.kill());

  // Recopy static assets (CSS, public/) on change.
  const recopy = debounce(() => {
    try {
      copyAssets();
    } catch (err) {
      console.error("asset copy failed:", err);
    }
  }, 100);
  fs.watch(path.join(root, "src", "styles"), { recursive: true }, recopy);
  fs.watch(path.join(root, "public"), { recursive: true }, recopy);

  // Tell connected browsers to reload whenever dist/ changes (js output or copied assets).
  const notify = debounce(broadcastReload, 150);
  fs.watch(dist, { recursive: true }, notify);
}

const server = http.createServer(async (req, res) => {
  if (req.url === "/__livereload") {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    res.write("\n");
    reloadClients.add(res);
    req.on("close", () => reloadClients.delete(res));
    return;
  }

  const requestPath = decodeURIComponent(req.url ?? "/").split("?")[0];
  const staticPath = path.join(dist, requestPath);
  const isStaticFile = fs.existsSync(staticPath) && fs.statSync(staticPath).isFile();

  if (!isStaticFile && req.url?.startsWith("/api")) {
    const target = new URL(req.url, apiTarget);
    try {
      const proxied = await fetch(target, {
        method: req.method,
        headers: req.headers,
        body: ["GET", "HEAD"].includes(req.method ?? "GET") ? undefined : req,
        duplex: "half",
      });
      res.writeHead(proxied.status, Object.fromEntries(proxied.headers));
      const buf = Buffer.from(await proxied.arrayBuffer());
      res.end(buf);
    } catch (err) {
      console.error(`proxy request failed: ${req.method} ${req.url}`, err);
      res.writeHead(502, { "content-type": "text/plain" });
      res.end("bad gateway");
    }
    return;
  }

  let filePath = path.join(dist, decodeURIComponent(req.url ?? "/").split("?")[0]);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(dist, "index.html");
  }

  const ext = path.extname(filePath);
  if (ext === ".html" && liveReload) {
    const html = fs.readFileSync(filePath, "utf8").replace("</body>", `${LIVE_RELOAD_SCRIPT}\n</body>`);
    res.writeHead(200, { "content-type": "text/html" });
    res.end(html);
    return;
  }

  res.writeHead(200, { "content-type": mimeTypes[ext] ?? "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(port, () => {
  console.log(`snorlax dev server on http://localhost:${port} (api -> ${apiTarget})`);
  if (liveReload) console.log("live reload enabled — watching src/ for changes");
});
