// Real components with EXAMPLE local fixtures; no live requests or submissions.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = process.cwd();
const fixture = await mkdtemp(path.join(root, '.qa-recovered-'));
const output = path.join(root, 'artifacts/visual-qa/recovered-portal');
await mkdir(output, { recursive: true });
await writeFile(path.join(fixture, 'index.html'), '<html lang="en"><head><title>EXAMPLE visual fixtures</title></head><body><div id="root"></div><script type="module" src="./fixture.tsx"></script></body></html>');
await writeFile(path.join(fixture, 'fixture.tsx'), `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PortalQuestionnaireCalendar } from '../client/src/pages/portal/PortalQuestionnaireCalendar';
import { PortalCommandPalette } from '../client/src/components/portal/shell/PortalCommandPalette';
import { PORTAL_NAV_GROUPS } from '../client/src/components/portal/shell/portalNav';
import { usePortalAppearance } from '../client/src/components/portal/shell/portalTheme';
import { Stars } from '../client/src/components/portal/kb/kbUi';
import { PageHero } from '../client/src/components/site/chapters';
import '../client/src/index.css';
const screen = new URLSearchParams(location.search).get('screen');
function Palette() { usePortalAppearance(); const [open, setOpen] = React.useState(false); return <><button onClick={() => setOpen(true)}>Open search</button><PortalCommandPalette groups={PORTAL_NAV_GROUPS} open={open} onOpenChange={setOpen} onSignOut={() => { throw new Error('Sign-out must not run in this fixture'); }} /></>; }
function Ratings() { usePortalAppearance(); return <main><h1>EXAMPLE article ratings</h1><Stars rating={{average:4.5,count:8}} /><Stars rating={{average:0,count:0}} /></main>; }
function Screen() { return screen === 'palette' ? <Palette /> : screen === 'stars' ? <Ratings /> : screen === 'hero' ? <main><PageHero title="EXAMPLE Mobile-readable heading" lede="Illustrative public hero using the actual decorative component." /></main> : <PortalQuestionnaireCalendar />; }
const client = new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false}}});
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><Screen /></QueryClientProvider>);
`);
const server = await createServer({configFile:false,root,esbuild:{jsx:'automatic'},resolve:{alias:{'@':path.join(root,'client/src'),'@shared':path.join(root,'shared'),'@assets':path.join(root,'attached_assets'),'@brand':path.join(root,'brand')}},server:{host:'127.0.0.1',port:0}});
let browser;
const observations = [];
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({headless:true});
  const TODAY=new Date().toISOString().slice(0,10),DUE=`${TODAY.slice(0,7)}-15`;
  const base={surveyId:'survey-1',description:'',questionCount:2,overdue:false,note:'',reviewedAt:null,clientId:'client-1',companyName:'EXAMPLE Co',assignedToUserId:'user-1',assignedByName:'EXAMPLE DE',reviewedByName:null};
  const EXAMPLE_OPEN={...base,id:'qa-open',title:'EXAMPLE Annual IT check-in',dueOn:DUE,status:'assigned',submittedAt:null,assignedToName:'EXAMPLE Person'};
  const EXAMPLE_SUBMITTED={...base,id:'qa-submitted',title:'EXAMPLE Onboarding survey',dueOn:DUE,status:'submitted',submittedAt:new Date().toISOString(),assignedToName:'EXAMPLE Owner'};
  for (const width of [390,768,1440]) for (const theme of ['light','dark']) {
    const context = await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
    await context.addInitScript(({theme}) => {localStorage.setItem('portalUser',JSON.stringify({id:'example-admin',role:'admin',fullName:'EXAMPLE Admin',email:'admin@example.invalid'}));localStorage.setItem('de-portal-theme',theme);localStorage.setItem('de-portal-tour-done','true');},{theme});
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    const errors=[],writes=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/api/**',async route=>{
      const req=route.request(),p=new URL(req.url()).pathname;
      if(req.method()!=='GET')writes.push(p);
      let body={};
      if(p==='/api/portal/me')body={user:{id:'example-admin',role:'admin',fullName:'EXAMPLE Admin',email:'admin@example.invalid'}};
      else if(p==='/api/portal/admin/tenants')body={tenants:[],mspCount:0,clientCount:0};
      else if(p==='/api/portal/agreements')body={mode:'off',exempt:true,status:{complete:true}};
      else if(p==='/api/portal/admin/questionnaires')body={today:TODAY,assignments:[EXAMPLE_OPEN,EXAMPLE_SUBMITTED]};
      else if(p==='/api/portal/admin/questionnaires/options')body={surveys:[{id:'survey-1',title:'EXAMPLE Annual IT check-in',category:'review',questionCount:2}]};
      else if(p==='/api/portal/admin/questionnaires/qa-submitted')body={assignment:{...EXAMPLE_SUBMITTED,questions:[{id:'q1',type:'text',label:'EXAMPLE What slowed you down this year?',required:true}],answers:{q1:'EXAMPLE The old printer.'}}};
      await route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
    });
    async function visit(screen){await page.goto(`${origin}/${path.basename(fixture)}/index.html?screen=${screen}`);await page.evaluate(()=>document.fonts.ready);if(screen!=='hero'){await page.locator('body[data-portal-theme]').waitFor();assert.equal(await page.locator('body').getAttribute('data-portal-theme'),theme);}}
    async function capture(screen){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${screen}: overflow`);await page.screenshot({path:path.join(output,`${screen}-${width}-${theme}.png`)});}
    async function checkAxe(screen){const result=await new AxeBuilder({page}).withRules(['aria-required-children','aria-allowed-attr','aria-dialog-name','aria-input-field-name']).analyze();await writeFile(path.join(output,`${screen}-${width}-${theme}.json`),JSON.stringify(result.violations,null,2));assert.deepEqual(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[],screen);}
    try {
      await visit('calendar');
      const currentMonth=await page.evaluate(()=>new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'}));
      await page.getByText(currentMonth,{exact:true}).waitFor();
      await page.getByTestId('assignment-qa-open').waitFor();
      assert.equal(await page.getByTestId('questionnaire-sample-banner').count(),0,'calendar: sample banner gone');
      await page.getByTestId('review-qa-submitted').click();
      await page.getByText('EXAMPLE The old printer.',{exact:true}).waitFor();
      await page.getByTestId('questionnaire-reviewed').waitFor();await capture('calendar');
      await visit('stars');await page.getByRole('img',{name:'Rated 4.5 out of 5 by 8',exact:true}).waitFor();await page.getByRole('img',{name:'Not rated yet',exact:true}).waitFor();await checkAxe('stars');
      await visit('palette');await page.getByRole('button',{name:'Open search',exact:true}).click();await page.getByRole('dialog',{name:'Search the portal',exact:true}).waitFor();
      const input=page.getByRole('combobox',{name:'Search the portal',exact:true});await input.fill('invoice');await page.getByRole('option',{name:/Invoices/}).waitFor();await checkAxe('palette-results');await capture('palette');
      await input.fill('no-example-page-matches-this');await page.getByText('Nothing matches.',{exact:false}).waitFor();await checkAxe('palette-empty');assert.equal(await page.getByRole('option',{name:/Nothing matches/}).getAttribute('aria-disabled'),'true');const emptyUrl=page.url();await page.keyboard.press('Enter');assert.equal(page.url(),emptyUrl);await page.getByRole('dialog',{name:'Search the portal',exact:true}).waitFor();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});assert.equal(await page.getByRole('dialog').count(),0);
      await visit('hero');await page.getByRole('heading',{name:'EXAMPLE Mobile-readable heading',exact:true}).waitFor();assert.equal(await page.locator('.de-hero-art').isVisible(),width>=1024);await capture('hero');
      assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
      observations.push({width,theme,currentMonth,questionnaireAssignments:true,reviewQueue:true,ratingSemantics:true,paletteAxe:true,heroDecoration:width>=1024,pageErrors:errors,writes});
    } catch(error){await page.screenshot({path:path.join(output,`failure-${width}-${theme}.png`)});await writeFile(path.join(output,`failure-${width}-${theme}.txt`),String(error)+'\n'+await page.locator('body').innerText());throw error;}
    await context.close();
  }
  await writeFile(path.join(output,'report.json'),JSON.stringify({scope:'EXAMPLE local component/browser verification, not production acceptance',observations},null,2));
  console.log(JSON.stringify(observations));
} finally {await browser?.close();await server.close();await rm(fixture,{recursive:true,force:true});}
