import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const paths = [
  "public/llms.txt",
  "public/v2/pages/contact.html",
  "public/v2/pages/assessment.html",
  "scrollcraft/builds/de-v2/pages/faq.html",
  "scrollcraft/builds/de-v2/pages/contact.html",
  "scrollcraft/builds/de-v2/pages/assessment.html",
  "public/v2/index.html",
  "scrollcraft/builds/de-v2/index.html",
  "public/scrollcraft/version-b/index.html",
  "scrollcraft/builds/situation-gallery/page.html",
  "scrollcraft/builds/situation-gallery/index.html",
  "public/scrollcraft/situation-gallery/index.html",
  "zoho/help-center/footer.html"
];
const retired = /(?:\+?1[\s().-]*)?(?:480[\s().-]*519[\s().-]*5892|855[\s().-]*534[\s().-]*9832|325[\s().-]*480[\s().-]*9870)/;
for (const path of paths) {
  test(path + ": retired public phone stays non-dialable", () => {
    const content = readFileSync(new URL("../" + path, import.meta.url), "utf8");
    assert.ok(!retired.test(content), "retired phone remains");
    assert.ok(content.includes("[DE_PUBLIC_PHONE]"), "pending phone marker missing");
    assert.ok(!/href=["']tel:[^"']*DE_PUBLIC_PHONE/i.test(content), "placeholder must not be dialable");
    assert.ok(!/"telephone"\s*:\s*"[^"]*DE_PUBLIC_PHONE/i.test(content), "placeholder must not be schema telephone");
  });
}
