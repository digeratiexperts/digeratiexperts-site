#!/usr/bin/env node
// Static server for standalone page builds (web-design-rules skill).
//   node .claude/skills/web-design-rules/scripts/serve.mjs [--root <dir>] [--port 3000]
// Serves <root> (default: current directory) at http://localhost:<port>. No dependencies.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const ROOT = path.resolve(flag("--root", "."));
const PORT = parseInt(flag("--port", "3000"), 10);
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".gif": "image/gif", ".mp4": "video/mp4", ".webm": "video/webm", ".woff2": "font/woff2", ".woff": "font/woff", ".ico": "image/x-icon", ".txt": "text/plain" };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || "/").split("?")[0]);
  let file = path.join(ROOT, url);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end("forbidden"); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end("not found: " + url); }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(file).pipe(res);
});
server.on("error", (e) => { console.error(e.code === "EADDRINUSE" ? `port ${PORT} is already in use; reuse that server or pass --port` : e.message); process.exit(1); });
server.listen(PORT, () => console.log(`serving ${ROOT} at http://localhost:${PORT}`));
