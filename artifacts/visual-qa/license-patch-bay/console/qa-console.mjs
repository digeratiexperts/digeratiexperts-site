import { chromium } from "/home/user/digeratiexperts-site/node_modules/playwright/index.mjs";
import fs from "node:fs";
// Visual QA for the console-style company page (2026-10-14). Dev server on :8080, dev admin.
const BASE="http://127.0.0.1:8080", OUT=process.argv[2]; fs.mkdirSync(OUT,{recursive:true});
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome"});
const s=await b.newContext();
const body=await (await s.request.post(`${BASE}/api/portal/login`,{data:{email:"admin@digeratiexperts.com",password:"DevPortal!2026",turnstileToken:"dev-bypass-token"}})).json();
const cookies=await s.cookies(); await s.close();
for (const w of [390,768,1440]) {
  const ctx=await b.newContext({viewport:{width:w,height:900}}); await ctx.addCookies(cookies);
  const p=await ctx.newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message));
  await p.goto(`${BASE}/portal/login`);
  await p.evaluate(u=>{localStorage.setItem("portalUser",JSON.stringify(u));localStorage.setItem("portalUserId",u.id);localStorage.setItem("cookie-consent","accepted");},body.user);
  await p.goto(`${BASE}/portal/admin/license-board`,{waitUntil:"networkidle"});
  await p.locator('section[aria-label="Client companies"] button').first().click(); await p.waitForTimeout(1200);
  const shots={};
  await p.screenshot({path:`${OUT}/patch-${w}.png`,fullPage:true});
  await p.getByRole("tab",{name:"Starter kit"}).click(); await p.waitForTimeout(400);
  await p.getByRole("button",{name:"Apply",exact:true}).first().click(); await p.waitForTimeout(200);
  await p.screenshot({path:`${OUT}/kit-${w}.png`,fullPage:true});
  await p.getByRole("button",{name:/^Apply to/}).click(); await p.waitForTimeout(1200);
  await p.getByRole("tab",{name:"JumpCloud installs"}).click(); await p.waitForTimeout(800);
  await p.getByLabel("Device group ID").fill("grp"+w+"abcdef"); await p.getByRole("button",{name:"Save link"}).click(); await p.waitForTimeout(1200);
  await p.screenshot({path:`${OUT}/jc-${w}.png`,fullPage:true});
  const over=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  const cut=await p.evaluate(()=>[...document.querySelectorAll("input")].filter(i=>i.placeholder&&i.scrollWidth>i.clientWidth).map(i=>i.placeholder));
  console.log(JSON.stringify({w,overflow:over,errors:errs,placeholderCut:cut}));
  await ctx.close();
}
await b.close();
