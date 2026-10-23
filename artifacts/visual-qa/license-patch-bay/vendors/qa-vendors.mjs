// "Microsoft & Google" tab on the License Patch Bay company page (2026-10-23). Dev server on :8080.
import { chromium } from "/home/user/digeratiexperts-site/node_modules/playwright/index.mjs";
const BASE="http://127.0.0.1:8080", OUT=process.argv[2];
const W=(process.argv[3]||"390,768,1440").split(",").map(Number);
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome"});
const s=await b.newContext();
let body=null;
for (let i=0;i<40&&!body;i++){ const r=await s.request.post(`${BASE}/api/portal/login`,{data:{email:"admin@digeratiexperts.com",password:"DevPortal!2026",turnstileToken:"dev-bypass-token"}}); if (r.ok()) body=await r.json(); else await new Promise(z=>setTimeout(z,15000)); }
const cookies=await s.cookies(); await s.close();
for (const w of W) {
  const ctx=await b.newContext({viewport:{width:w,height:1000}}); await ctx.addCookies(cookies);
  const p=await ctx.newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message));
  await p.goto(`${BASE}/portal/login`);
  await p.evaluate(u=>{localStorage.setItem("portalUser",JSON.stringify(u));localStorage.setItem("portalUserId",u.id);localStorage.setItem("cookie-consent","accepted");},body.user);
  await p.goto(`${BASE}/portal/admin/license-board?company=client-1`,{waitUntil:"networkidle"});
  await p.getByRole("tab",{name:"Microsoft & Google"}).click(); await p.waitForTimeout(800);
  const panel=p.locator('[role="tabpanel"][data-state="active"]');
  await panel.getByPlaceholder("contoso.onmicrosoft.com").fill(`acme${w}-${Date.now()}.onmicrosoft.com`);
  await panel.getByRole("button",{name:"Save link"}).first().click(); await p.waitForTimeout(900);
  await panel.getByPlaceholder("admin@client.com").fill(`admin${w}-${Date.now()}@acme.test`);
  await panel.getByRole("button",{name:"Save link"}).nth(1).click(); await p.waitForTimeout(900);
  const ready=await panel.getByText("Ready",{exact:true}).count();
  const fix=await panel.getByRole("button",{name:"Save SKU"}).count();
  const send=await panel.getByRole("button",{name:/^Send to Microsoft 365$/}).isDisabled();
  await p.locator('[role="tabpanel"][data-state="active"]').screenshot({path:`${OUT}/vendors-${w}.png`});
  const over=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  console.log(JSON.stringify({w,ready,skuFixers:fix,sendDisabledNoCreds:send,overflow:over,errors:errs}));
  await ctx.close();
}
await b.close();
