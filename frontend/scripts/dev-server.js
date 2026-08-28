import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { cpSync, mkdirSync } from "node:fs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, "dist");
const port = process.env.PORT ?? 5173;
const apiTarget = process.env.API_TARGET ?? "http://localhost:8080";
const liveReload = process.env.LIVE_RELOAD !== "0";

// --- Minimal ANSI helpers (no dependency — keeps this project's zero-dependency ethos) ---
const useColor = process.stdout.isTTY && process.env.NO_COLOR === undefined;
const c = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const dim = c(2);
const bold = c(1);
const green = c(32);
const red = c(31);
const yellow = c(33);
const cyan = c(36);
const gray = c(90);

function timestamp() {
  return dim(new Date().toLocaleTimeString());
}

/** Draws a simple rounded box banner around the given lines. */
function banner(lines) {
  const width = Math.max(...lines.map((l) => stripAnsi(l).length));
  const top = `╭${"─".repeat(width + 2)}╮`;
  const bottom = `╰${"─".repeat(width + 2)}╯`;
  const body = lines.map((l) => `│ ${l}${" ".repeat(width - stripAnsi(l).length)} │`);
  return [dim(top), ...body, dim(bottom)].join("\n");
}

function stripAnsi(s) {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

/** Small ASCII rendering of the Hearth mascot (round ears, hood, closed happy eyes) for the startup banner. */
function mascot() {
  const innerWidth = 15;
  const center = (s) => {
    const left = Math.floor((innerWidth - s.length) / 2);
    return " ".repeat(Math.max(0, left)) + s + " ".repeat(Math.max(0, innerWidth - s.length - left));
  };
  const ears = "(‾)         (‾)";
  const earsIndent = " ".repeat(Math.max(0, Math.floor((innerWidth + 2 - ears.length) / 2)));
  return [
    `${earsIndent}${cyan(ears)}`,
    cyan(`╭${"─".repeat(innerWidth)}╮`),
    `${cyan("│")}${cyan("▔".repeat(innerWidth))}${cyan("│")}`,
    `${cyan("│")}${bold(center("◠     ◠"))}${cyan("│")}`,
    `${cyan("│")}${center("‿")}${cyan("│")}`,
    cyan(`╰${"─".repeat(innerWidth)}╯`),
  ].join("\n");
}

/** Reformats raw `tsc --watch` output into compact, colorized status lines. */
function watchTscOutput(child) {
  const rl = readline.createInterface({ input: child.stdout });
  let sawError = false;

  rl.on("line", (raw) => {
    const line = raw.trim();
    if (line === "") return;

    if (/Starting compilation in watch mode|File change detected/.test(line)) {
      sawError = false;
      console.log(`${timestamp()}  ${yellow("⏳ compiling…")}`);
      return;
    }

    const errorsMatch = line.match(/Found (\d+) errors?\. Watching for file changes\./);
    if (errorsMatch) {
      const count = Number(errorsMatch[1]);
      if (count === 0) {
        console.log(`${timestamp()}  ${green("✓ no errors")} ${dim("— ready")}`);
      } else {
        console.log(`${timestamp()}  ${red(`✗ ${count} error${count === 1 ? "" : "s"}`)}`);
      }
      return;
    }

    if (/error TS\d+/.test(line)) {
      sawError = true;
      console.log(`  ${red(line)}`);
      return;
    }

    // Continuation lines of a multi-line diagnostic (e.g. wrapped messages).
    console.log(sawError ? `  ${gray(line)}` : dim(`  ${line}`));
  });

  child.stderr.on("data", (buf) => process.stderr.write(buf));
}

const mimeTypes = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".map": "application/json",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
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
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
  watchTscOutput(tsc);
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
  console.log(mascot());
  console.log(
    banner([
      `${bold(cyan("hearth"))} dev server`,
      `${dim("url")}   http://localhost:${port}`,
      `${dim("api")}   ${apiTarget}`,
      `${dim("live")}  ${liveReload ? green("reload enabled") : gray("reload disabled")}`,
    ]),
  );
});
