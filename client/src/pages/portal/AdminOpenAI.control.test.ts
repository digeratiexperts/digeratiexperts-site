import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { chromium, type Browser, type BrowserContext, type Page, type Route } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

// Real Chromium navigation/interaction uses the same 15s budget as the existing
// EventSession browser fixture; the default 5s unit budget expires under full-suite load.
vi.setConfig({ testTimeout: 15_000 });

const response = (enabled: boolean) => ({ success: true, status: { enabled, configured: true, persistence: "process", restartEnabled: true }, message: "Runtime state" });
describe("OpenAI admin control with synthetic HTTP only", () => {
  let server: ViteDevServer, browser: Browser, context: BrowserContext, page: Page;
  let fixture: string, base: string;
  let statusReply: unknown, statusCode: number, posts: string[], outside: string[];
  let change: (route: Route) => Promise<void>;
  const evidence = process.env.OPENAI_CONTROL_EVIDENCE_DIR;
  beforeAll(async () => {
    const root = process.cwd(); fixture = await mkdtemp(join(root, ".qa-openai-control-"));
    await writeFile(join(fixture, "index.html"), '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>EXAMPLE OpenAI control</title></head><body><div id="root"></div><script type="module" src="/fixture.tsx"></script></body></html>');
    await writeFile(join(fixture, "fixture.tsx"), `
      import React from 'react'; import { createRoot } from 'react-dom/client';
      import { QueryClientProvider } from '@tanstack/react-query';
      import { HelmetProvider } from 'react-helmet-async';
      import { queryClient } from '@/lib/queryClient';
      import { AdminOpenAI } from '@/pages/portal/AdminOpenAI';
      import '@/styles/brand-fonts.css'; import '@/index.css';
      createRoot(document.getElementById('root')!).render(<HelmetProvider><QueryClientProvider client={queryClient}><AdminOpenAI /></QueryClientProvider></HelmetProvider>);
    `);
    server = await createServer({ configFile: false, root: fixture, cacheDir: join(fixture, ".vite"), publicDir: resolve(root, "client/public"), esbuild: { jsx: "automatic" }, optimizeDeps: { entries: ["index.html"] }, resolve: { alias: { "@": resolve(root, "client/src"), "@shared": resolve(root, "shared"), "@assets": resolve(root, "attached_assets"), "@brand": resolve(root, "brand") } }, server: { host: "127.0.0.1", port: 0 } });
    await server.listen(); const addr = server.httpServer!.address(); if (!addr || typeof addr === "string") throw Error("No fixture port"); base = `http://127.0.0.1:${addr.port}`;
    await server.transformRequest("/fixture.tsx"); await server.waitForRequestsIdle();
    browser = await chromium.launch({ ...(existsSync('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium' } : {}), args: ['--no-sandbox'] });
  }, 90_000);
  beforeEach(async () => {
    statusReply = response(true); statusCode = 200; posts=[]; outside=[];
    change = async route => { const enabled = route.request().url().endsWith('/enable'); statusReply = response(enabled); await route.fulfill({ json: statusReply }); };
    context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== base) { outside.push(url.origin); return route.abort(); }
      if (url.pathname === '/api/portal/admin/openai/status') return route.fulfill({ status: statusCode, json: statusReply });
      if (url.pathname.startsWith('/api/portal/admin/openai/')) { posts.push(url.pathname); return change(route); }
      if (url.pathname === '/api/portal/me') return route.fulfill({ json: { user: { id: 'fixture-admin', email: 'admin@example.invalid', role: 'admin', fullName: 'Synthetic Admin', storeRole: 'managed', clientId: null } } });
      if (url.pathname === '/api/portal/events/stream') return route.fulfill({ headers: { 'content-type': 'text/event-stream' }, body: ': fixture\n\n' });
      if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
      return route.continue();
    }); page = await context.newPage();
  });
  afterEach(async () => { await context?.close(); });
  afterAll(async () => { try { await browser?.close(); } finally { await server?.close(); if (fixture) await rm(fixture, { recursive: true, force: true }); } });
  const open = async () => { await page.goto(base+'/portal/admin/openai', { waitUntil: 'domcontentloaded' }); await page.getByTestId('button-set-openai').waitFor({ timeout: 60_000 }); };
  it('renders confirmed state and honestly discloses restart scope', async () => {
    await open(); await page.getByRole('button', { name: 'Disable OpenAI', exact: true }).waitFor();
    if (evidence) await page.screenshot({ path: join(evidence,'admin-before-or-after.png'), fullPage: true });
    expect(await page.getByText(/this server process/i).count()).toBeGreaterThan(0);
    expect(await page.getByText(/restart.*enabled|enabled.*restart/i).count()).toBeGreaterThan(0);
    expect(await page.getByText('Configured', { exact: true }).count()).toBeGreaterThan(0);
  });
  it('uses explicit desired-state endpoints and confirms the response', async () => {
    await open(); await page.getByRole('button', { name: 'Disable OpenAI', exact: true }).click();
    await page.getByRole('button', { name: 'Enable OpenAI', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Enable OpenAI', exact: true }).click();
    await page.getByRole('button', { name: 'Disable OpenAI', exact: true }).waitFor();
    expect(posts).toEqual(['/api/portal/admin/openai/disable','/api/portal/admin/openai/enable']);
  });
  it('blocks changes for malformed or unavailable status', async () => {
    statusReply = { success:true, enabled:true, status:'configured' };
    await open(); expect(await page.getByTestId('button-set-openai').isDisabled()).toBe(true);
    statusCode = 503;
    await page.getByTestId('button-refresh-openai-status').click();
    expect(await page.getByTestId('button-set-openai').isDisabled()).toBe(true);
    expect(posts).toHaveLength(0);
  });
  it('does not claim success for a malformed or unconfirmed mutation', async () => {
    change = async route => { await route.fulfill({ json: { success:true } }); };
    await open(); await page.getByRole('button', { name:'Disable OpenAI', exact:true }).click();
    await page.getByText(/could not confirm|couldn't confirm/i).waitFor();
    expect(await page.getByRole('button', { name:'Enable OpenAI', exact:true }).count()).toBe(0);
  });
  it('keeps controls pending and renders a safe mutation error', async () => {
    let release!: () => void;
    const held = new Promise<void>(r => { release=r; });
    change = async route => { await held; await route.fulfill({ status:500, json:{ error:'Synthetic private backend details' } }); };
    await open(); await page.getByRole('button', { name:'Disable OpenAI', exact:true }).click();
    expect(await page.getByTestId('button-set-openai').isDisabled()).toBe(true);
    expect(await page.getByTestId('button-refresh-openai-status').isDisabled()).toBe(true);
    release(); await page.getByText(/could not confirm|couldn't confirm/i).waitFor();
    expect(await page.getByText('Synthetic private backend details', { exact:false }).count()).toBe(0);
    expect(posts).toHaveLength(1);
  });
  it.each([390,768,1440])('fits and renders at %spx with no provider traffic', async width => {
    await page.setViewportSize({ width, height: 1000 }); await open();
    await page.getByRole('button',{name:'Disable OpenAI',exact:true}).waitFor();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.getByTestId('button-set-openai').evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    if(evidence) await page.screenshot({path:join(evidence,`admin-${width}.png`),fullPage:true});
    expect(outside.filter(x=>/openai|anthropic|elevenlabs/i.test(x))).toHaveLength(0);
    expect(posts).toHaveLength(0);
  });
});
