// Visual QA for the console-style pool page (2026-10-14). Dev server on :8080, dev admin.
import { chromium } from "/home/user/digeratiexperts-site/node_modules/playwright/index.mjs";
import fs from "node:fs";
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
  await p.getByRole("button",{name:"Add from catalog"}).first().click(); await p.waitForTimeout(700);
  await p.screenshot({path:`${OUT}/catalog-${w}.png`});
  const add=p.getByRole("button",{name:/^Add .* to the pool$/}).first();
  let added=false; if (await add.count()) { await add.click(); await p.waitForTimeout(900); added=true; }
  await p.getByRole("dialog").getByRole("button",{name:"Close"}).last().click(); await p.waitForTimeout(600);
  // patch the first licence onto the first company with click-to-patch
  const jack=p.locator('section[aria-label="DE licence pool"] button[aria-label^="Pick up a cable"]').first();
  let patched=false;
  if (await jack.count()) { await jack.focus(); await p.keyboard.press("Enter"); await p.waitForTimeout(300);
    const here=p.locator('[data-patch-target^="client:"]').first(); if (await here.count()) { await here.click(); await p.waitForTimeout(1200); patched=true; } }
  await p.screenshot({path:`${OUT}/pool-${w}.png`,fullPage:true});
  const over=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  console.log(JSON.stringify({w,added,patched,overflow:over,errors:errs}));
  await ctx.close();
}
await b.close();
