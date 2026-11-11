import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * Which pages get prerendered: every indexable page in shared/routeMeta.json (the
 * sitemap snapshot), minus app surfaces whose HTML is per-visitor or a live tool.
 */
const EXCLUDED_PREFIXES = ["/store", "/portal", "/internal", "/quote-wizard", "/concepts", "/version"];

export function prerenderRoutes() {
  if (process.env.PRERENDER_ROUTES) {
    return process.env.PRERENDER_ROUTES.split(",").map((r) => r.trim()).filter(Boolean);
  }
  const meta = JSON.parse(readFileSync(path.join(root, "shared/routeMeta.json"), "utf8"));
  return Object.entries(meta)
    .filter(([route, m]) => !/noindex/i.test(m.robots || ""))
    .map(([route]) => route)
    .filter((route) => !EXCLUDED_PREFIXES.some((p) => route === p || route.startsWith(`${p}/`)))
    .sort();
}

/** "/" -> "index.html", "/locations/phoenix-az" -> "locations__phoenix-az.html". */
export function snapshotFileName(route) {
  if (route === "/") return "index.html";
  return `${route.replace(/^\/+|\/+$/g, "").replace(/[^a-zA-Z0-9-]+/g, "__")}.html`;
}
