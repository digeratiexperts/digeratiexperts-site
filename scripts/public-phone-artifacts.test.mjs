import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const marker = "[DE_PUBLIC_PHONE]";
const retired = /(?:\+?1[\s().-]*)?(?:480[\s().-]*519[\s().-]*5892|855[\s().-]*534[\s().-]*9832|325[\s().-]*480[\s().-]*9870)/;
const inspected = JSON.parse(execFileSync("python3", ["scripts/public-phone-artifacts.py"], { cwd: root, encoding: "utf8", maxBuffer: 10_000_000 }));
const required = JSON.parse(readFileSync(new URL("public-phone-pdf-manifest.json", import.meta.url), "utf8")).pdfs;

test("all expected public PDFs are inspected", () => {
  assert.ok(inspected.length >= 46);
  for (const path of required) assert.ok(inspected.some((pdf) => pdf.path === path), path);
});

for (const pdf of inspected) {
  test(`${pdf.path}: no retired number or fake callable marker`, () => {
    assert.ok(pdf.pages > 0);
    assert.ok(!retired.test(pdf.text), "retired phone in extracted text");
    for (const uri of pdf.uris) {
      assert.ok(!retired.test(uri), "retired phone in link annotation");
      assert.ok(!/^(?:tel|callto):/i.test(uri) || !/DE_PUBLIC_PHONE|%5b|%5d/i.test(uri), "fake phone link");
    }
    if (required.includes(pdf.path)) assert.ok(pdf.text.includes(marker), "contact marker missing");
  });
}

test("concept contact helper preserves a real configured line", async () => {
  const { publicPhoneMarkup } = await import("../artifacts/design-concepts/resource-pdfs/lib/public-phone.mjs");
  assert.equal(publicPhoneMarkup({ phone: "480-555-0100", phoneHref: "tel:+14805550100" }), '<a href="tel:+14805550100">480-555-0100</a>');
  assert.equal(publicPhoneMarkup({ phone: "480-555-0100", phoneHref: "javascript:alert(1)" }), `<span>${marker}</span>`);
});

for (const concept of ["a-editorial", "b-technical", "c-executive"]) {
  test(`${concept}: pending public phone renders plain text`, async () => {
    const { render } = await import(`../artifacts/design-concepts/resource-pdfs/concepts/${concept}.mjs`);
    const content = JSON.parse(readFileSync(new URL("artifacts/design-concepts/resource-pdfs/content/proactive-it.json", root), "utf8"));
    for (const phoneHref of ["", `tel:${marker}`, "tel:+13254809870"]) {
      const fixture = structuredClone(content);
      fixture.cta.phone = marker;
      fixture.cta.phoneHref = phoneHref;
      const { body } = render(fixture);
      assert.ok(body.includes(marker));
      assert.ok(!/<a\b[^>]*href=["'](?:tel|callto):/i.test(body), "pending phone must not be clickable");
    }
    // The main-branch concept content predates #1031. It must also be safe
    // before that dependency is reconciled.
    assert.ok(!retired.test(render(content).body), "retired concept data leaked into rendered output");
  });
}
