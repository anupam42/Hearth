import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, "dist");
const port = process.env.PORT ?? 5173;
const apiTarget = process.env.API_TARGET ?? "http://localhost:8080";

const mimeTypes = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".map": "application/json",
  ".json": "application/json",
};

const server = http.createServer(async (req, res) => {
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
  res.writeHead(200, { "content-type": mimeTypes[ext] ?? "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(port, () => {
  console.log(`snorlax dev server on http://localhost:${port} (api -> ${apiTarget})`);
});
