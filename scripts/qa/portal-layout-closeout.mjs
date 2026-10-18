// Actual Portal components with isolated EXAMPLE responses. Never calls production.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = process.cwd();
const fixture = await mkdtemp(path.join(root, '.qa-portal-layout-'));
const output = path.join(root, 'artifacts/visual-qa/portal-layout-closeout');
await mkdir(output, { recursive: true });
await writeFile(path.join(fixture, 'index.html'), '<html lang="en"><head><title>EXAMPLE Portal layout verification</title></head><body><div id="root"></div><script type="module" src="./fixture.tsx"></script></body></html>');
await writeFile(path.join(fixture, 'fixture.tsx'), `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../client/src/lib/queryClient';
import Infrastructure from '../client/src/pages/portal/PortalInfrastructure';
import CreateTicket from '../client/src/pages/portal/PortalCreateTicket';
import Tickets from '../client/src/pages/portal/PortalTickets';
import Sales from '../client/src/pages/portal/SalesProcess';
import Roadmap from '../client/src/pages/portal/PortalRoadmap';
import Files from '../client/src/pages/portal/PortalFiles';
import Invoices from '../client/src/pages/portal/PortalInvoices';
import Order from '../client/src/pages/portal/OrderForm';
import { AdminOpenAI as OpenAI } from '../client/src/pages/portal/AdminOpenAI';
import { PortalAdminDataSources as DataSources } from '../client/src/pages/portal/PortalAdminDataSources';
import '../client/src/index.css';
const screens = {infrastructure:[Infrastructure,'infrastructure'],create:[CreateTicket,'tickets/create'],tickets:[Tickets,'tickets'],sales:[Sales,'sales-process'],roadmap:[Roadmap,'roadmap'],files:[Files,'files'],invoices:[Invoices,'invoices'],order:[Order,'order-form'],openai:[OpenAI,'admin/openai'],sources:[DataSources,'admin/data-sources']};
const [Screen, route] = screens[new URLSearchParams(location.search).get('screen') || 'infrastructure'];
history.replaceState({}, '', '/portal/' + route);
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={queryClient}><Screen /></QueryClientProvider>);
`);
const server = await createServer({ configFile:false, root, esbuild:{jsx:'automatic'}, resolve:{alias:{'@':path.join(root,'client/src'),'@shared':path.join(root,'shared'),'@assets':path.join(root,'attached_assets'),'@brand':path.join(root,'brand')}}, server:{host:'127.0.0.1',port:0} });
let browser;
const observations=[];
try {
  await server.listen();
  const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
  browser=await chromium.launch({headless:true});
  for(const width of [390,768,1440]) for(const theme of ['light','dark']) {
    const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
    const user={id:'example-admin',role:'admin',fullName:'EXAMPLE Admin',email:'admin@example.invalid',clientId:'example-company',client:{companyName:'EXAMPLE Client'}};
    await context.addInitScript(({user,theme})=>{localStorage.setItem('portalUser',JSON.stringify(user));localStorage.setItem('de-portal-theme',theme);localStorage.setItem('de-portal-tour-done','true');},{user,theme});
    const page=await context.newPage();page.setDefaultTimeout(20000);
    const errors=[],writes=[];
    let enabled=false,statusFailure=false,companyName='EXAMPLE Client';
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/api/**',async route=>{
      const req=route.request(),p=new URL(req.url()).pathname;
      let body={},status=200;
      if(req.method()!=='GET') {
        writes.push(p);
        if(req.method()==='POST' && p==='/api/portal/admin/openai/enable')enabled=true;
        else if(req.method()==='POST' && p==='/api/portal/admin/openai/disable')enabled=false;
        else return route.fulfill({status:409,contentType:'application/json',body:'{"error":"Unexpected fixture write"}'});
        body={success:true};
      } else if(p==='/api/portal/me')body={user};
      else if(p==='/api/portal/admin/tenants')body={tenants:[],mspCount:0,clientCount:0};
      else if(p==='/api/portal/agreements')body={mode:'off',exempt:true,status:{complete:true}};
      else if(p==='/api/portal/tickets')body={tickets:[]};
      else if(p==='/api/portal/invoices')body={invoices:[],zohoConnected:true};
      else if(p==='/api/portal/my-files')body={files:[],companyName};
      else if(p==='/api/portal/admin/openai/status'){status=statusFailure?503:200;body=statusFailure?{message:'EXAMPLE unavailable'}:{status:{enabled,apiKey:'Configured (EXAMPLE)',baseUrl:'https://example.invalid'},message:'EXAMPLE status'};}
      else if(p==='/api/portal/admin/data-sources')body={success:true,areas:[],companies:[],qaLogin:{emailEnv:'EXAMPLE_EMAIL',passwordEnv:'EXAMPLE_PASSWORD',emailSet:false,passwordSet:false},envExample:'deploy/vps/env.production.example'};
      await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    });
    async function visit(screen){await page.goto(`${origin}/${path.basename(fixture)}/index.html?screen=${screen}`);await page.locator('body[data-portal-theme]').waitFor();assert.equal(await page.locator('body').getAttribute('data-portal-theme'),theme);await page.locator('main h1').first().waitFor();await page.evaluate(()=>document.fonts.ready);}
    async function capture(screen){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${screen}: document overflow`);await page.screenshot({path:path.join(output,`${screen}-${width}-${theme}.png`)});}
    async function placeholderFits(){assert(await page.getByTestId('input-search').evaluate(el=>{const s=getComputedStyle(el);const c=document.createElement('canvas').getContext('2d');c.font=s.font;return c.measureText(el.placeholder).width<=el.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight)-20;}),'Search placeholder fits');}
    try {
      for(const screen of ['infrastructure','create']) {
        await visit(screen);
        const phone=page.getByRole('link',{name:'Call 325-480-9870',exact:true});
        assert.equal(await phone.getAttribute('href'),'tel:+13254809870');
        assert.equal(await phone.evaluate(el=>getComputedStyle(el).whiteSpace),'nowrap');
        if(screen==='create'){assert.equal((await page.getByTestId('select-priority').innerText()).trim(),'Medium');assert.equal(await page.getByText('Soon; response within 4 hours',{exact:true}).count(),1);}
        if(width===390)assert(await page.getByTestId('admin-mode-client').evaluate(el=>el.clientWidth>=250),'Mobile client selector has a full row');
        await capture(screen);
      }
      await visit('tickets');await placeholderFits();await capture('tickets');
      await visit('sales');await placeholderFits();
      if(width>=1024)assert(await page.locator('#sales-lead-gen article').last().evaluate(el=>{const parent=el.parentElement.getBoundingClientRect(),last=el.getBoundingClientRect();return parent.right-last.right<=24;}),'Lead source cards fill the desktop row');
      await capture('sales');
      await visit('roadmap');await page.getByTestId('roadmap-sample-banner').waitFor();
      assert(await page.getByRole('img',{name:/Budget:/}).evaluate(el=>{const lum=color=>{const parts=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;});return parts[0]*0.2126+parts[1]*0.7152+parts[2]*0.0722;};const a=lum(getComputedStyle(el).backgroundColor),b=lum(getComputedStyle(el.closest('.bg-card')).backgroundColor);return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)>=3;}),'Available budget has at least 3:1 contrast against its card');
      await capture('roadmap');
      await visit('files');await page.getByText('Software, agents and documents DE prepared for EXAMPLE Client.',{exact:true}).waitFor();await capture('files');
      companyName='';await visit('files');await page.getByText('Software, agents and documents shared with your organization.',{exact:true}).waitFor();assert(!/Your Company/.test(await page.locator('main').innerText()));await capture('files-unmapped');
      await visit('invoices');await page.getByTestId('stat-total-invoices').waitFor();
      if(width<1024)assert(await page.getByTestId('stat-outstanding').evaluate(el=>{const card=el.parentElement,grid=card.parentElement;return Math.abs(card.getBoundingClientRect().width-grid.getBoundingClientRect().width)<2;}),'Last invoice tile spans its row');
      await capture('invoices');
      await visit('sources');const file=page.getByTestId('data-sources-how-to-switch').locator('code').first();assert.equal(await file.innerText(),'deploy/vps/env.production.example');assert.equal(await file.evaluate(el=>getComputedStyle(el).whiteSpace),'nowrap');await capture('sources');
      await visit('order');await page.getByText('IT',{exact:true}).first().waitFor();assert.equal(await page.getByText('It',{exact:true}).count(),0);
      if(width>=1024){assert(await page.locator('nav[aria-label="Client portal"] a[aria-current="page"]').evaluate(el=>{const item=el.getBoundingClientRect(),box=el.closest('[data-sidebar="content"]').getBoundingClientRect();return item.top>=box.top-1&&item.bottom<=box.bottom+1;}),'Active New Order item is visible above the footer');}
      await capture('order');
      await visit('openai');const change=page.getByTestId('button-set-openai');await page.getByRole('button',{name:'Enable OpenAI',exact:true}).waitFor();assert.equal(await page.getByTestId('button-toggle-openai').count(),0);await capture('openai');
      await change.click();await page.getByRole('button',{name:'Disable OpenAI',exact:true}).waitFor();await change.click();await page.getByRole('button',{name:'Enable OpenAI',exact:true}).waitFor();
      statusFailure=true;await visit('openai');await page.getByText('Integration status is unavailable',{exact:true}).waitFor();assert(await change.isDisabled());await capture('openai-unavailable');
      statusFailure=false;await page.getByTestId('button-refresh-openai-status').click();await page.getByRole('button',{name:'Enable OpenAI',exact:true}).waitFor();assert(!(await change.isDisabled()));
      assert.deepEqual(writes,['/api/portal/admin/openai/enable','/api/portal/admin/openai/disable']);assert.deepEqual(errors,[]);
      observations.push({width,theme,phoneUnbroken:true,selectorFits:true,placeholdersFit:true,invoiceRowFilled:true,explicitOpenAiState:true,statusRecovery:true,pageErrors:errors,isolatedFixtureWrites:writes});
    }catch(error){await page.screenshot({path:path.join(output,`failure-${width}-${theme}.png`)});await writeFile(path.join(output,`failure-${width}-${theme}.txt`),String(error)+'\n'+await page.locator('body').innerText());throw error;}
    await context.close();
  }
  await writeFile(path.join(output,'report.json'),JSON.stringify({scope:'Isolated EXAMPLE component/browser evidence; no production configuration changed',observations},null,2));console.log(JSON.stringify(observations));
}finally{await browser?.close();await server.close();await rm(fixture,{recursive:true,force:true});}
