// Lane A: rendered navigation evidence per account type (portal sidebar), at
// 390 / 768 / 1024 / 1440. Real PortalLayout with isolated EXAMPLE responses —
// never production. Modeled on scripts/qa/portal-layout-closeout.mjs.
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
const output = path.join(root, 'artifacts/visual-qa/lane-a-roles-nav', baseline ? 'before' : 'after');
await mkdir(output, { recursive: true });
const fixture = await mkdtemp(path.join(root, '.qa-lane-a-'));
await writeFile(path.join(fixture, 'index.html'), '<html lang="en"><head><title>Lane A portal navigation</title></head><body><div id="root"></div><script type="module" src="./fixture.tsx"></script></body></html>');
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

/** Honest empty EXAMPLE data — never figures the product would not have. */
const EMPTY_STATS = {
  openTickets: 0,
  resolvedTickets: 0,
  activeServices: 0,
  pendingInvoices: 0,
  recentTickets: [],
  services: [],
  zohoConnected: true,
};

// EXAMPLE accounts. navContext mirrors GET /api/portal/me (lane A).
const USERS = {
  'break-glass': {
    id: 'u-break', role: 'admin', fullName: 'EXAMPLE Break-glass', email: 'breakglass@example.invalid',
    clientId: null, accountClass: 'super_admin', clientRoles: [],
    navContext: { entitlements: [], data: { sharedFiles: false, itPlan: false } },
    client: { companyName: 'Digerati Experts' },
  },
  'de-staff': {
    id: 'u-staff', role: 'staff', fullName: 'EXAMPLE DE Staff', email: 'staff@example.invalid',
    clientId: 'msp-digerati', accountClass: 'de_staff', clientRoles: [],
    navContext: { entitlements: [], data: { sharedFiles: false, itPlan: false } },
    client: { companyName: 'Digerati Experts' },
  },
  standard: {
    id: 'u-plain', role: 'user', orgRole: 'staff', fullName: 'EXAMPLE User', email: 'user@example.invalid',
    clientId: 'c-a', accountClass: 'client', clientRoles: ['standard'],
    navContext: { entitlements: [], data: { sharedFiles: false, itPlan: false } },
    client: { companyName: 'EXAMPLE Client' },
  },
  'standard-files': {
    id: 'u-plain2', role: 'user', orgRole: 'staff', fullName: 'EXAMPLE User 2', email: 'user2@example.invalid',
    clientId: 'c-a', accountClass: 'client', clientRoles: ['standard'],
    navContext: { entitlements: [], data: { sharedFiles: true, itPlan: false } },
    client: { companyName: 'EXAMPLE Client' },
  },
  approver: {
    id: 'u-appr', role: 'user', orgRole: 'manager', fullName: 'EXAMPLE Approver', email: 'approver@example.invalid',
    clientId: 'c-a', accountClass: 'client', clientRoles: ['approver'],
    navContext: { entitlements: [], data: { sharedFiles: true, itPlan: false } },
    client: { companyName: 'EXAMPLE Client' },
  },
  'client-admin': {
    id: 'u-cadmin', role: 'user', orgRole: 'company_it_contact', isCompanyItContact: true, fullName: 'EXAMPLE Client Admin', email: 'cadmin@example.invalid',
    clientId: 'c-a', accountClass: 'client', clientRoles: ['client_admin', 'billing', 'purchaser', 'owner', 'approver'],
    navContext: { entitlements: ['cloud_edge', 'voice', 'security_awareness'], data: { sharedFiles: true, itPlan: true } },
    client: { companyName: 'EXAMPLE Client' },
  },
};

let browser;
const observations = [];
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true });

  for (const width of [390, 768, 1024, 1440]) {
    for (const [role, user] of Object.entries(USERS)) {
      const context = await browser.newContext({ viewport: { width, height: 1100 }, reducedMotion: 'reduce' });
      await context.addInitScript((u) => {
        localStorage.setItem('portalUser', JSON.stringify(u));
        localStorage.setItem('de-portal-theme', 'light');
        localStorage.setItem('de-portal-tour-done', 'true');
      }, user);
      const page = await context.newPage();
      page.setDefaultTimeout(60000);
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.route('**/api/**', async (route) => {
        const req = route.request();
        const p = new URL(req.url()).pathname;
        let body = {};
        if (p === '/api/portal/me') body = { success: true, user };
        else if (p === '/api/portal/dashboard') body = EMPTY_STATS;
        else if (p === '/api/portal/admin/login-knocks') body = { knocks: [], summary: { total: 0 } };
        else if (p === '/api/portal/integrations') body = { integrations: user.id === 'u-cadmin'
          ? {
              vpn: { mode: 'live', provider: 'manual' },
              phone: { mode: 'live', provider: 'manual' },
              shipping: { mode: 'live', provider: 'manual' },
            }
          : {
              vpn: { mode: 'sample', provider: null },
              phone: { mode: 'sample', provider: null },
              shipping: { mode: 'sample', provider: null },
            } };
        else if (p === '/api/portal/agreements') body = { mode: 'off', exempt: true, status: { complete: true } };
        else if (p === '/api/portal/my-files') body = { files: [], companyName: user.client?.companyName || '' };
        else if (p === '/api/portal/admin/tenants') body = { tenants: [], mspCount: 0, clientCount: 0 };
        else body = {};
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      });

      const labels = async () =>
        page.evaluate(() =>
          Array.from(document.querySelectorAll('nav[aria-label="Client portal"] a'))
            .map((a) => (a.textContent || '').replace(/sample/ig, '').trim())
            .filter((label) => label.length > 0),
        );

      try {
        await page.goto(`${origin}/${path.basename(fixture)}/index.html?screen=dashboard`, { timeout: 120000 });
        await page.locator('main').first().waitFor();
        // Let the integrations / session queries settle: they can add menu items.
        await page.waitForLoadState('networkidle');
        await page.evaluate(() => document.fonts.ready);

        // Open the mobile drawer below 1024px so the menu is what we capture.
        const trigger = page.locator('[data-sidebar="trigger"]');
        if (width < 1024 && await trigger.isVisible()) {
          await trigger.click();
          await page.locator('nav[aria-label="Client portal"]').waitFor();
        }
        await page.screenshot({ path: path.join(output, `menu-${role}-${width}.png`) });

        const items = await labels();
        if (!baseline) {
          if (role === 'break-glass') {
            for (const expected of ['Dashboard', 'DE Questionnaires', 'Infrastructure Issues', 'Data Import', 'Manage Agents', 'VPN Access']) {
              assert(items.includes(expected), `break-glass keeps ${expected} (got ${items.join(', ')})`);
            }
            assert(!items.includes('Home'), 'break-glass keeps today’s labels (no rename)');
          }
          if (role === 'de-staff') {
            assert(items.includes('Home') && items.includes('Get help') && items.includes('Companies'), 'DE staff get the target menu + DE Admin subset');
            assert(items.includes('Infrastructure Issues'), 'DE staff see finished DE-only items');
            for (const hidden of ['DE Questionnaires', 'System Status', 'Login Alerts', 'Data Import', 'Manage Agents', 'Ship Center']) {
              assert(!items.includes(hidden), `DE staff never see ${hidden}`);
            }
          }
          if (role === 'standard') {
            assert.deepEqual(items, ['Home', 'Get help', 'My requests', 'How-to guides', 'Desktop agent', 'My profile'], 'standard user sees the plan’s items');
          }
          if (role === 'standard-files') {
            assert(items.includes('Files'), 'Files appears when a file is shared');
          }
          if (role === 'approver') {
            assert(items.includes('Approvals'), 'approver sees Approvals');
            assert(!items.includes('Billing and contracts'), 'approver without the billing hat sees no billing item');
          }
          if (role === 'client-admin') {
            for (const expected of ['People and devices', 'Billing and contracts', 'Order equipment', 'Secure access', 'Business phone', 'Security training']) {
              assert(items.includes(expected), `client admin with entitlements sees ${expected}`);
            }
            for (const hidden of ['Infrastructure Issues', 'Structure & IDs', 'DE Questionnaires']) {
              assert(!items.includes(hidden), `client roles never see ${hidden}`);
            }
          }
          assert.deepEqual(errors, [], 'no page errors');
        }
        observations.push({ role, width, items, pageErrors: errors });
      } catch (error) {
        await page.screenshot({ path: path.join(output, `failure-${role}-${width}.png`) });
        throw error;
      }
      await context.close();
    }

    // Route guard: a hidden route redirects to Home with a note (after only).
    if (!baseline && width === 1440) {
      const context = await browser.newContext({ viewport: { width, height: 1100 }, reducedMotion: 'reduce' });
      await context.addInitScript((u) => {
        localStorage.setItem('portalUser', JSON.stringify(u));
        localStorage.setItem('de-portal-theme', 'light');
        localStorage.setItem('de-portal-tour-done', 'true');
      }, USERS.standard);
      const page = await context.newPage();
      await page.route('**/api/**', async (route) => {
        const p = new URL(route.request().url()).pathname;
        const body = p === '/api/portal/me'
          ? { success: true, user: USERS.standard }
          : p === '/api/portal/dashboard'
            ? EMPTY_STATS
            : p === '/api/portal/integrations'
              ? { integrations: { vpn: { mode: 'sample', provider: null }, phone: { mode: 'sample', provider: null }, shipping: { mode: 'sample', provider: null } } }
              : p === '/api/portal/agreements'
                ? { mode: 'off', exempt: true, status: { complete: true } }
                : {};
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      });
      await page.goto(`${origin}/${path.basename(fixture)}/index.html?screen=roadmap`, { timeout: 120000 });
      await page.getByTestId('nav-not-available').waitFor();
      const note = (await page.getByTestId('nav-not-available').innerText()).trim();
      assert(/not available for your account/i.test(note), `guard note reads: ${note}`);
      // The guard redirected to Home: the hidden page is gone from the viewport.
      await page.getByText('Strategic IT Roadmap', { exact: false }).waitFor({ state: 'detached' });
      await page.getByTestId('text-dashboard-title').waitFor();
      await page.screenshot({ path: path.join(output, 'guard-not-available-1440.png') });
      observations.push({ guard: note, width });
      await context.close();
    }
  }

  await writeFile(path.join(output, 'report.json'), JSON.stringify({
    scope: 'Isolated EXAMPLE portal navigation evidence; no production configuration changed',
    baseline,
    observations,
  }, null, 2));
  console.log(JSON.stringify({ baseline, captured: observations.length }));
} finally {
  await browser?.close();
  await server.close();
  await rm(fixture, { recursive: true, force: true });
}
