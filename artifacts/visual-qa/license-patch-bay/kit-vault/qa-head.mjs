import { chromium } from "/home/user/digeratiexperts-site/node_modules/playwright/index.mjs";
const BASE="http://127.0.0.1:8080", OUT=process.argv[2];
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome"});
const s=await b.newContext();
const body=await (await s.request.post(`${BASE}/api/portal/login`,{data:{email:"admin@digeratiexperts.com",password:"DevPortal!2026",turnstileToken:"dev-bypass-token"}})).json();
const cookies=await s.cookies(); await s.close();
for (const w of [390,1440]) {
  const ctx=await b.newContext({viewport:{width:w,height:900}}); await ctx.addCookies(cookies);
  const p=await ctx.newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message));
  await p.goto(`${BASE}/portal/login`);
  await p.evaluate(u=>{localStorage.setItem("portalUser",JSON.stringify(u));localStorage.setItem("portalUserId",u.id);localStorage.setItem("cookie-consent","accepted");},body.user);
  await p.goto(`${BASE}/portal/admin/license-board`,{waitUntil:"networkidle"});
  await p.screenshot({path:`${OUT}/pool-${w}.png`,fullPage:false});
  await p.goto(`${BASE}/portal/admin/license-board?company=client-1`,{waitUntil:"networkidle"}); await p.waitForTimeout(1000);
  await p.screenshot({path:`${OUT}/head-${w}.png`,fullPage:false});
  const chips=await p.evaluate(()=>[...document.querySelectorAll("header ~ div button, header ~ div a")].slice(0,6).map(e=>e.textContent.trim()));
  const over=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  console.log(JSON.stringify({w,chips,overflow:over,errors:errs}));
  await ctx.close();
}
await b.close();
