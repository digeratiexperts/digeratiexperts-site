// EXAMPLE browser fixtures. No production requests, vendor calls, orders or licence writes.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = process.cwd();
const fixture = await mkdtemp(path.join(root, '.qa-company-'));
const output = path.join(root, 'artifacts/visual-qa/portal-company-context');
await mkdir(output, { recursive: true });
await writeFile(path.join(fixture, 'index.html'), '<html><body><div id="root"></div><script type="module" src="./fixture.tsx"></script></body></html>');
await writeFile(path.join(fixture, 'fixture.tsx'), `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Company from '../client/src/pages/portal/PortalCompany';
import Procurement from '../client/src/pages/portal/PortalProcurementStore';
import Licensing from '../client/src/pages/portal/PortalLicensing';
import Loaner from '../client/src/pages/portal/requests/PortalLoanerComputerRequest';
import Return from '../client/src/pages/portal/requests/PortalReturnComputerRequest';
import License from '../client/src/pages/portal/requests/PortalLicenseRequest';
import '../client/src/index.css';
const screens = { company: Company, procurement: Procurement, licensing: Licensing, loaner: Loaner, return: Return, license: License };
const Screen = screens[new URLSearchParams(location.search).get('screen') || 'company'];
const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><Screen /></QueryClientProvider>);
`);
const server = await createServer({ configFile: false, root, esbuild: { jsx: 'automatic' }, resolve: { alias: { '@': path.join(root, 'client/src'), '@shared': path.join(root, 'shared'), '@assets': path.join(root, 'attached_assets'), '@brand': path.join(root, 'brand') } }, server: { host: '127.0.0.1', port: 0 } });
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.PORTAL_QA_CHROMIUM_PATH || undefined, headless: true });
  const observations = [];
  for (const width of [390, 768, 1440]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    await context.addInitScript(({ theme }) => {
      localStorage.setItem('portalUser', JSON.stringify({ id: 'example-admin', role: 'admin', fullName: 'EXAMPLE Admin', email: 'admin@example.invalid' }));
      localStorage.setItem('de-portal-theme', theme);
      localStorage.setItem('de-portal-tour-done', 'true');
    }, { theme });
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    const errors = [];
    const writes = [];
    page.on('pageerror', error => errors.push(error.message));
    let state = 'missing';
    let policy = 'empty';
    let releasePolicy;
    let policyWait;
    await page.route('**/api/**', async route => {
      const request = route.request();
      const url = new URL(request.url());
      const p = url.pathname;
      let status = 200;
      let body = {};
      if (request.method() !== 'GET') writes.push(p);
      if (p === '/api/portal/me') body = { user: { id: 'example-admin', role: 'admin', fullName: 'EXAMPLE Admin', email: 'admin@example.invalid' } };
      else if (p === '/api/portal/admin/tenants') body = { tenants: [], mspCount: 0, clientCount: 0 };
      else if (p === '/api/portal/agreements') body = { mode: 'off', exempt: true, status: { complete: true } };
      else if (p === '/api/portal/company') body = state === 'ready' ? { status: 'ready', canChooseCompany: true, company: { id: 'example-a', name: 'EXAMPLE Selected Company A', email: 'company@example.invalid', phone: 'Not provided', industry: 'EXAMPLE industry' }, team: [{ id: 'example-member', name: 'EXAMPLE Team Member', email: 'member@example.invalid', isItContact: true }] } : { status: state === 'unavailable' ? 'company_unavailable' : 'choose_company', canChooseCompany: true, company: null, team: [] };
      else if (p === '/api/portal/service-requests/context') {
        if (state !== 'ready') { status = 400; body = { code: state === 'unavailable' ? 'COMPANY_NOT_FOUND' : 'COMPANY_CONTEXT_REQUIRED', error: 'Choose a company' }; }
        else body = { success: true, company: { id: 'example-a', name: 'EXAMPLE Selected Company A' }, me: { userId: 'example-member', name: 'EXAMPLE Team Member', email: 'member@example.invalid' }, sites: [], defaultSiteId: null };
      }
      else if (p === '/api/portal/service-requests/people') body = { people: [{ userId: 'example-member', name: 'EXAMPLE Team Member', email: 'member@example.invalid' }] };
      else if (p === '/api/portal/service-requests/assets') body = { assets: [] };
      else if (p === '/api/portal/service-requests/basket') body = { requests: [] };
      else if (p === '/api/portal/licensing/entitlements') {
        if (policy === 'loading') await policyWait;
        if (policy === 'error') { status = 503; body = { error: 'EXAMPLE temporary policy outage' }; }
        else body = { classification: { accountType: 'employee', tier: null }, platforms: policy === 'ready' ? [{ platform: 'm365', tenantLabel: 'EXAMPLE tenant' }] : [], licenses: policy === 'ready' ? [{ platform: 'm365', licenseKey: 'example-license', name: 'EXAMPLE Requestable Licence', kind: 'addon', assignment: 'request', approval: 'none', group: 'EXAMPLE group' }] : [] };
      }
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    });
    async function visit(screen) { await page.goto(`${origin}/${path.basename(fixture)}/index.html?screen=${screen}`); }
    async function capture(name) {
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}: overflow at ${width}/${theme}`);
      await page.screenshot({ path: path.join(output, `${name}-${width}-${theme}.png`), fullPage: true });
    }
    async function disabled() {
      await page.waitForFunction(() => [...document.querySelectorAll('button')].filter(b => /^(Order Now|Add to Cart)$/.test(b.textContent.trim())).length > 0);
      const buttons = page.getByRole('button', { name: /^(Order Now|Add to Cart)$/ });
      for (const button of await buttons.all()) assert(await button.isDisabled());
    }
    await visit('company');
    await page.getByText('Choose a company to continue', { exact: true }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Choose a company', exact: true }).getAttribute('href'), '/portal/admin/companies');
    assert.equal(await page.getByText('CRM not connected yet').count(), 0);
    state = 'unavailable'; await visit('company');
    await page.getByText('Company record unavailable', { exact: true }).waitFor();
    state = 'ready'; await visit('company');
    await page.getByText('EXAMPLE Selected Company A', { exact: true }).waitFor();
    // DataTable renders a visible card below md and a visible row at md+.
    await page.getByTestId(width < 768 ? 'contact-row-example-member-card' : 'contact-row-example-member').waitFor();
    await capture('company-ready');
    state = 'missing';
    for (const screen of ['loaner', 'return', 'license']) {
      await visit(screen);
      await page.getByText('Choose a company to continue', { exact: true }).waitFor();
      await disabled();
      assert.equal(await page.getByText('No licence policy on file yet', { exact: true }).count(), 0);
      await capture(`${screen}-choose-company`);
    }
    await visit('licensing');
    await page.getByText('Choose a company to continue', { exact: true }).waitFor();
    assert.equal(await page.getByText("Licensing couldn't be loaded", { exact: true }).count(), 0);
    state = 'ready'; policy = 'loading'; policyWait = new Promise(resolve => { releasePolicy = resolve; });
    await visit('license');
    await page.getByText('Loading licence policy', { exact: true }).waitFor();
    await disabled();
    assert.equal(await page.getByText('No licence policy on file yet', { exact: true }).count(), 0);
    policy = 'error'; releasePolicy();
    await page.getByText("Licences couldn't be loaded", { exact: true }).waitFor();
    await disabled();
    assert.equal(await page.getByText('No licence policy on file yet', { exact: true }).count(), 0);
    policy = 'empty'; await visit('license');
    await page.getByText('No licence policy on file yet', { exact: true }).waitFor();
    await disabled();
    policy = 'ready'; await visit('license');
    await page.getByRole('radio', { name: /EXAMPLE Requestable Licence/ }).check();
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Order Now' && !b.disabled));
    await capture('license-ready');
    await visit('procurement');
    const marketplace = page.getByRole('link', { name: 'Open marketplace', exact: true });
    await marketplace.waitFor();
    assert.equal(await marketplace.getAttribute('href'), '/portal/marketplace');
    assert.equal(await page.getByRole('button', { name: 'Add', exact: true }).count(), 0);
    assert(!/\$299|\$1,999|\$2,499|\$799/.test(await page.locator('body').innerText()));
    await capture('procurement');
    assert.deepEqual(errors, []);
    assert.deepEqual(writes, []);
    observations.push({ width, theme, selectedCompany: true, missingCompany: true, missingRecord: true, submitReadiness: true, policyStates: ['loading', 'error', 'empty', 'ready'], marketplaceContinuation: true, overflow: false, pageErrors: errors, writes });
    await context.close();
  }
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ classification: 'EXAMPLE local browser fixtures; not production evidence', observations }, null, 2));
  console.log(JSON.stringify(observations));
} finally {
  await browser?.close();
  await server.close();
  await rm(fixture, { recursive: true, force: true });
}
