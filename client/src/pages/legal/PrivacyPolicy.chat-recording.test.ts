import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "PrivacyPolicy.tsx"), "utf8");

describe("Privacy Policy chat and call recording section", () => {
  it("publishes the three approved subsections under the chat-recording heading", () => {
    const section = src.slice(src.indexOf('id="chat-recording"'), src.indexOf("8. Data Retention and Deletion"));
    expect(section).toContain('id="chat-recording"');
    expect(section).toContain("7. Chat and call recording and AI processing");
    expect(section).toContain("<h3");
    expect(section).toContain("Website and Portal Chat (DE Desk)");
    expect(section).toContain("Phone Calls: Recording and AI Analysis");
    expect(section).toContain("Laws About Recording and Chat in Some States");
    expect(section).toContain(
      "If you describe your situation in the box on our homepage, that description is handled the same way: it is sent to our AI service provider to suggest services and kept with your chat session. It is saved to an IT &amp; Security Profile only if you later choose to save a draft.",
    );
    expect(section).toContain("A current list of these providers is available on request.");
    expect(section).toContain("{{CHAT_RETENTION}}");
    expect(section).toContain('say "do not record."');
    expect(section).toContain("admin@digeratiexperts.com");
    expect(section).not.toContain("Internal — do not publish this note.");
    expect(section).not.toContain("SUBPROCESSOR_URL");
    expect(section).not.toContain("press [9]");
    expect(section).not.toContain("privacy-chat-recording-pending");
    expect(section).not.toContain("[24 months]");
    expect(section).not.toContain("[12 months]");
  });
});
