// W1 dashboard truth: the Home verdict and figure tiles under three EXAMPLE
// data states (billing unreachable, items waiting on the client, load failure)
// at 390 / 768 / 1440. Real PortalDashboard, isolated responses, never production.
// Modeled on scripts/qa/lane-a-roles-nav.mjs.
//
//   node scripts/qa/lane-a-roles-nav.mjs            # after: asserts the target menu
//   QA_BASELINE=1 node scripts/qa/lane-a-roles-nav.mjs   # before (run with cwd on the
//                                                    # pre-change tree): screenshots only
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const baseline = process.env.QA_BASELINE === '1';
const output = path.join(root, 'artifacts/visual-qa/w1-dashboard-truth', baseline ? 'before' : 'after');
await mkdir(output, { recursive: true });
const fixture = await mkdtemp(path.join(root, '.qa-w1-'));
await writeFile(path.join(fixture, 'index.html'), '<html lang="en"><head><title>W1 dashboard truth</title></head><body><div id="root"></div><script type="module" src="./fixture.tsx"></script></body></html>');
await writeFile(path.join(fixture, 'fixture.tsx'), `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { Router, useLocation } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import { queryClient } from '../client/src/lib/queryClient';
import Dashboard from '../client/src/pages/portal/PortalDashboard';
import Roadmap from '../client/src/pages/portal/PortalRoadmap';
import '../client/src/index.css';
// Swap screens on navigation so the route guard's redirect behaves as it does
// behind wouter in the real app.
function Screens() {
  const [location] = useLocation();
  return location.startsWith('/portal/roadmap') ? <Roadmap /> : <Dashboard />;
}
const start = new URLSearchParams(location.search).get('screen') === 'roadmap' ? '/portal/roadmap' : '/portal/dashboard';
const routing = memoryLocation({ path: start });
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={queryClient}><Router hook={routing.hook}><Screens /></Router></QueryClientProvider>);
`);

const prebundle = ['react', 'react-dom/client', 'wouter', 'wouter/memory-location', '@radix-ui/react-select', '@radix-ui/react-progress', '@tanstack/react-query'];
const server = await createServer({
  configFile: false,
  root,
  publicDir: path.join(root, 'client/public'),
  esbuild: { jsx: 'automatic' },
  optimizeDeps: { include: prebundle },
  resolve: { alias: { '@': path.join(root, 'client/src'), '@shared': path.join(root, 'shared'), '@assets': path.join(root, 'attached_assets'), '@brand': path.join(root, 'brand') } },
  server: { host: '127.0.0.1', port: 0 },
});


const USER = {
  id: 'u-cadmin', role: 'user', orgRole: 'company_it_contact', isCompanyItContact: true, fullName: 'EXAMPLE Client Admin', email: 'cadmin@example.invalid',
  clientId: 'c-a', accountClass: 'client', clientRoles: ['client_admin', 'billing', 'purchaser', 'owner', 'approver'],
  navContext: { entitlements: [], data: { sharedFiles: true, itPlan: true } },
  client: { companyName: 'EXAMPLE Client' },
};
const T = (id, subject, status) => ({ id, ticketNumber: `EX-${id}`, subject, status, priority: 'medium', createdAt: '2026-10-20T16:00:00Z' });
/** EXAMPLE states only. null = the source could not be read. */
const STATES = {
  'billing-unreachable': { status: 200, body: { openTickets: 1, resolvedTickets: 4, waitingOnClient: 0, activeServices: null, pendingInvoices: null, recentTickets: [T('1', 'EXAMPLE printer offline', 'in_progress')], services: [], zohoConnected: true } },
  'waiting-on-client': { status: 200, body: { openTickets: 1, resolvedTickets: 4, waitingOnClient: 2, activeServices: 2, pendingInvoices: 1, recentTickets: [T('2', 'EXAMPLE confirm new hire laptop', 'pending_client'), T('3', 'EXAMPLE VPN access', 'in_progress')], services: [{ id: 's1', serviceName: 'EXAMPLE Managed Security', status: 'live' }, { id: 's2', serviceName: 'EXAMPLE Backup', status: 'live' }], zohoConnected: true } },
  'load-failed': { status: 500, body: { message: 'Failed to load dashboard' } },
  'tickets-unknown': { status: 200, body: { openTickets: null, resolvedTickets: null, waitingOnClient: null, ticketSource: 'unavailable', activeServices: null, pendingInvoices: null, billingStatus: 'not_linked', recentTickets: [], services: [], zohoConnected: false } },
  'null-rows': { status: 200, body: { openTickets: 1, resolvedTickets: 0, waitingOnClient: 0, ticketSource: 'local', activeServices: 0, pendingInvoices: 0, billingStatus: 'ok', recentTickets: [null, { id: 9 }, T('4', 'EXAMPLE kept row', 'open'), 'x'], services: [null, { serviceName: 'no id' }], zohoConnected: true } },
};
let browser;
const observations = [];
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true, ...(process.env.QA_CHROMIUM ? { executablePath: process.env.QA_CHROMIUM } : {}) });
  for (const theme of ['light', 'dark']) {
  for (const width of [390, 768, 1440]) {
    for (const [name, state] of Object.entries(STATES)) {
      const context = await browser.newContext({ viewport: { width, height: 1100 }, reducedMotion: 'reduce' });
      await context.addInitScript(([u, t]) => {
        localStorage.setItem('portalUser', JSON.stringify(u));
        localStorage.setItem('de-portal-theme', t);
        localStorage.setItem('de-portal-tour-done', 'true');
      }, [USER, theme]);
      const page = await context.newPage();
      page.setDefaultTimeout(60000);
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e.stack || e.message).split('\n').slice(0, 3).join(' | ')));
      await page.route('**/api/**', async (route) => {
        const p = new URL(route.request().url()).pathname;
        if (p === '/api/portal/dashboard') return route.fulfill({ status: state.status, contentType: 'application/json', body: JSON.stringify(state.body) });
        let body = {};
        if (p === '/api/portal/me') body = { success: true, user: USER };
        else if (p === '/api/portal/integrations') body = { integrations: { vpn: { mode: 'sample', provider: null }, phone: { mode: 'sample', provider: null }, shipping: { mode: 'sample', provider: null } } };
        else if (p === '/api/portal/agreements') body = { mode: 'off', exempt: true, status: { complete: true } };
        else if (p === '/api/portal/my-files') body = { files: [], companyName: 'EXAMPLE Client' };
        else if (p === '/api/portal/status') body = { success: true, overall: 'operational', active: [], inProgress: [], upcoming: [], recent: [] };
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      });
      await page.goto(`${origin}/${path.basename(fixture)}/index.html?screen=dashboard`, { timeout: 120000 });
      await page.getByTestId('dashboard-verdict').waitFor();
      await page.waitForFunction(() => !document.querySelector('[data-testid="dashboard-verdict"] .animate-pulse'), null, { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(500);
      const verdictEl = page.getByTestId('dashboard-verdict');
      if (!(await verdictEl.count())) {
        await page.screenshot({ path: path.join(output, `DEBUG-${name}-${width}.png`) });
        throw new Error(`${name}@${width}: verdict gone; url=${page.url()} errors=${JSON.stringify(errors).slice(0, 600)}`);
      }
      const verdict = (await verdictEl.innerText()).replace(/\s+/g, ' ').trim();
      const tiles = {};
      for (const id of ['stat-open-tickets', 'stat-resolved-tickets', 'stat-active-services', 'stat-pending-invoices']) {
        tiles[id] = (await page.getByTestId(id).innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      await page.screenshot({ path: path.join(output, `${theme}-${name}-${width}.png`), fullPage: false });
      observations.push({ theme, width, state: name, verdict, tiles, overflow, errors });
      if (!baseline) {
        assert.ok(!/watching/i.test(verdict), `${name}@${width}: monitoring claim`);
        assert.equal(overflow, false, `${name}@${width}: sideways scroll`);
        if (name !== 'waiting-on-client' && name !== 'null-rows') assert.match(tiles['stat-pending-invoices'], /—/, `${name}@${width}: unknown invoices shown as a number`);
        if (name === 'waiting-on-client') assert.match(verdict, /3 items are waiting on you/, `${name}@${width}: waiting count`);
        if (name === 'tickets-unknown') {
          assert.match(verdict, /couldn't confirm your ticket status/i, `${name}@${width}: unknown tickets read as all-clear`);
          assert.match(tiles['stat-open-tickets'], /—/, `${name}@${width}: unknown open tickets shown as a number`);
          assert.equal(await page.getByText('billing not linked', { exact: true }).count(), 2, `${name}@${width}: not-linked hint on both billing tiles`);
          assert.equal(await page.getByText('No tickets yet').count(), 0, `${name}@${width}: claims no tickets`);
        }
        if (name === 'null-rows') assert.equal(await page.getByText('EXAMPLE kept row').count(), 1, `${name}@${width}: valid row lost`);
        assert.equal(errors.length, 0, `${name}@${width}: page errors ${errors.join(' | ')}`);
      }
      await context.close();
    }
  }
  }
  await writeFile(path.join(output, 'observations.json'), JSON.stringify(observations, null, 2));
  console.log(JSON.stringify(observations.map((o) => [o.theme, o.width, o.state, o.verdict.slice(0, 70), o.tiles['stat-pending-invoices'], o.overflow, o.errors.length]), null, 0));
} finally {
  await browser?.close();
  await server.close();
  await rm(fixture, { recursive: true, force: true });
}
