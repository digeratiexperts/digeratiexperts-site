// Local EXAMPLE rendering of real catalog components. Never authenticates or orders.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const fixture = await mkdtemp(path.join(root, '.qa-provider-cards-'));
const output = path.join(root, 'artifacts/visual-qa/de-owned-product-cards');
await mkdir(output, { recursive: true });
await writeFile(path.join(fixture, 'cart.ts'), 'export const useCart = () => ({ items: [] });');
await writeFile(path.join(fixture, 'index.html'), '<html><body><div id="root"></div><script type="module" src="./fixture.tsx"></script></body></html>');
await writeFile(path.join(fixture, 'fixture.tsx'), `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { StoreProductCard } from '../client/src/components/store/StoreProductCard';
import { ProductMedia } from '../client/src/components/store/ProductMedia';
import { storeProducts } from '../client/src/data/storeProducts';
import { deOwnedServiceSkus } from '../client/src/data/vendorLogos';
import '../client/src/index.css';
const products = storeProducts.filter(p => deOwnedServiceSkus.has(p.sku));
createRoot(document.getElementById('root')!).render(<main className="mx-auto max-w-6xl p-4">
  <h1 className="mb-4 text-xl">EXAMPLE local component verification</h1>
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{products.map(p =>
    <section key={p.sku} data-sku={p.sku} className="min-w-0">
      <StoreProductCard product={p} price={p.basePrice} onAddToCart={() => { throw new Error('Ordering is outside this fixture'); }} />
    </section>)}</div>
  <h2 className="my-4 text-xl">Shared product detail media</h2>
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{products.map(p =>
    <section key={p.sku} data-detail-sku={p.sku} className="min-w-0"><ProductMedia product={p} variant="detail" /></section>)}</div>
</main>);
`);
const server = await createServer({ configFile: false, root, publicDir: path.join(root, 'client/public'),
  esbuild: { jsx: 'automatic' }, resolve: { alias: [
    { find: '@/contexts/CartContext', replacement: path.join(fixture, 'cart.ts') },
    { find: '@', replacement: path.join(root, 'client/src') },
    { find: '@shared', replacement: path.join(root, 'shared') },
    { find: '@assets', replacement: path.join(root, 'attached_assets') },
    { find: '@brand', replacement: path.join(root, 'brand') },
  ] }, server: { host: '127.0.0.1', port: 0 } });
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true });
  const observations = [];
  const expected = ['DE-SVC-MGD-BUSINESS-MO', 'DE-SVC-MGD-ENTERPRISE-MO', 'DE-SVC-MGD-CYBER-MO', 'DE-DIG-TPL-IR-RUNBOOK-OT'];
  for (const width of [390, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(15_000);
    const errors = [], apiRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', route => { apiRequests.push(route.request().url()); return route.abort(); });
    await page.goto(`${origin}/${path.basename(fixture)}/index.html`);
    await page.locator('[data-sku]').first().waitFor();
    assert.equal(await page.locator('[data-sku]').count(), expected.length);
    for (const sku of expected) for (const attribute of ['data-sku', 'data-detail-sku']) {
      const surface = page.locator(`[${attribute}="${sku}"]`);
      await surface.scrollIntoViewIfNeeded();
      await surface.getByText('DE', { exact: true }).waitFor();
      assert.equal(await surface.locator('[data-testid^="product-vendor-logo-"]').count(), 0, sku);
      const semantics = await surface.evaluate(el => ({ text: el.textContent, images: [...el.querySelectorAll('img')].map(i => ({ src: i.getAttribute('src'), alt: i.alt })) }));
      assert(!/guardz|blackpoint/i.test(JSON.stringify(semantics)), `${sku}: internal provider disclosed`);
      assert(semantics.text.includes('Digerati Experts'), `${sku}: missing DE accessible label`);
      await surface.locator('img').evaluateAll(images => Promise.all(images.map(i => i.decode())));
      assert(await surface.locator('img').evaluateAll(images => images.every(i => i.naturalWidth > 0)), `${sku}: broken image`);
    }
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `overflow at ${width}`);
    await page.screenshot({ path: path.join(output, `cards-${width}.png`), fullPage: true });
    assert.deepEqual(errors, []);
    assert.deepEqual(apiRequests, []);
    observations.push({ width, skus: expected, cardAndDetail: true, providerDisclosure: false, brokenImages: false, overflow: false, pageErrors: errors, apiRequests });
    await page.close();
  }
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ scope: 'EXAMPLE local real-component fixture; no authenticated production catalog or customer transaction', observations }, null, 2));
  console.log(JSON.stringify(observations));
} finally {
  await browser?.close();
  await server.close();
  await rm(fixture, { recursive: true, force: true });
}
