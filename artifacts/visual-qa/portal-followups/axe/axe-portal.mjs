// axe-core WCAG 2.x A/AA audit of every portal route, dark and light, at 1440
// (and 390 for a phone pass). One dev-only login; results aggregated by rule.
// usage: node axe-portal.mjs <out.json> [width=1440] [themes=dark,light]
import { chromium } from "/home/user/digeratiexperts-site/node_modules/playwright/index.mjs";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://127.0.0.1:8080";
const here = path.dirname(new URL(import.meta.url).pathname);
const AXE = fs.readFileSync(path.join(here, "../axe/node_modules/axe-core/axe.min.js"), "utf8");
const out = process.argv[2] || path.join(here, "axe.json");
const width = Number(process.argv[3] || 1440);
const themes = (process.argv[4] || "dark,light").split(",");

const AUTHED = ["/portal/dashboard", "/portal/tickets", "/portal/tickets/create", "/portal/forms", "/portal/infrastructure",
  "/portal/chat", "/portal/approvals", "/portal/kb", "/portal/company", "/portal/people", "/portal/contracts", "/portal/files",
  "/portal/billing", "/portal/invoices", "/portal/services", "/portal/orders", "/portal/order-form", "/portal/questionnaires",
  "/portal/surveys", "/portal/learning", "/portal/roadmap", "/portal/qbr", "/portal/marketplace", "/portal/procurement",
  "/portal/vpn", "/portal/cytracom", "/portal/ship-center", "/portal/agent", "/portal/status", "/portal/settings",
  "/portal/sales-process", "/portal/admin/companies", "/portal/admin/contracts", "/portal/admin/agents",
  "/portal/admin/import", "/portal/admin/lifecycle", "/portal/admin/login-knocks", "/portal/admin/openai"];
const PUBLIC = ["/portal/login", "/portal/signup", "/portal/forgot-password", "/portal/reset-password", "/portal/reset-password?token=x"];

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const seed = await browser.newContext();
const login = await seed.request.post(`${BASE}/api/portal/login`, {
  data: { email: "admin@digeratiexperts.com", password: "DevPortal!2026", turnstileToken: "dev-bypass-token" },
});
let body = await login.json().catch(() => ({}));
let cookies;
if (body.user) { cookies = await seed.cookies(); fs.writeFileSync(path.join(here, "session.json"), JSON.stringify({ cookies, user: body.user })); }
else { const s = JSON.parse(fs.readFileSync(path.join(here, "session.json"), "utf8")); cookies = s.cookies; body = { user: s.user }; }
await seed.close();

const byRule = {};
const perPage = [];
async function audit(route, theme, authed) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 } });
  if (authed) await ctx.addCookies(cookies);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/portal/login`);
  await page.evaluate(({ u, t, authed }) => {
    if (authed) { localStorage.setItem("portalUser", JSON.stringify(u)); localStorage.setItem("portalUserId", u.id); }
    localStorage.setItem("de-portal-theme", t);
    localStorage.setItem("cookie-consent", "accepted");
  }, { u: body.user, t: theme, authed });
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(700);
  await page.addScriptTag({ content: AXE });
  const res = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const r = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] }, resultTypes: ["violations"] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map((n) => ({ target: n.target.join(" "), html: n.html.slice(0, 160), summary: (n.failureSummary || "").slice(0, 200) })) }));
  });
  perPage.push({ route, theme, count: res.reduce((a, v) => a + v.nodes.length, 0) });
  for (const v of res) {
    const r = (byRule[v.id] ||= { id: v.id, impact: v.impact, help: v.help, nodes: 0, pages: new Set(), samples: [] });
    r.nodes += v.nodes.length;
    r.pages.add(`${route} [${theme}]`);
    for (const n of v.nodes) if (r.samples.length < (v.id==="color-contrast"?400:8) && !r.samples.some((s) => s.target === n.target)) r.samples.push({ route, theme, ...n });
  }
  await ctx.close();
}
for (const theme of themes) {
  for (const r of AUTHED) await audit(r, theme, true);
  if (theme === themes[0]) for (const r of PUBLIC) await audit(r, "dark", false);
}
await browser.close();
const rules = Object.values(byRule).map((r) => ({ ...r, pages: [...r.pages] })).sort((a, b) => b.nodes - a.nodes);
fs.writeFileSync(out, JSON.stringify({ width, themes, perPage, rules }, null, 2));
console.log(`width ${width}; pages audited: ${perPage.length}; total violation nodes: ${perPage.reduce((a, p) => a + p.count, 0)}`);
for (const r of rules) console.log(`${String(r.nodes).padStart(5)}  ${r.impact.padEnd(8)} ${r.id.padEnd(28)} on ${r.pages.length} page-views  — ${r.help}`);
