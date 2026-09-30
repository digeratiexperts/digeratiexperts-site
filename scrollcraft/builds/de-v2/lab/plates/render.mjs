import { createRequire } from "node:module";
const { chromium } = createRequire("/home/user/digeratiexperts-site/package.json")("playwright-core");
const jobs = JSON.parse(process.argv[2]);
const b = await chromium.launch({ executablePath: process.env.SCROLLCRAFT_CHROME, headless: true });
for (const j of jobs) {
  const p = await b.newPage({ viewport: { width: j.w, height: j.h } });
  await p.goto(`file:///home/user/digeratiexperts-site/scrollcraft/builds/de-v2/lab/plates/generator.html?plate=${j.plate}&seed=${j.seed}&w=${j.w}&h=${j.h}`);
  await p.waitForFunction(() => document.title.startsWith("ready:"));
  await p.locator("#c").screenshot({ path: `lab/plates/out/${j.name}.png` });
  await p.close();
  console.log("rendered", j.name);
}
await b.close();
