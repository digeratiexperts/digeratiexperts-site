import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { escapeEmailHtml } from "./emailEscape";
import { notificationService } from "./notificationService";

const INJECT = `<a href="https://evil.example">click</a><script>x()</script>"'&`;

describe("notification emails escape caller-supplied text", () => {
  const sent: any[] = [];
  beforeEach(() => {
    sent.length = 0;
    vi.stubEnv("ZEPTOMAIL_API_TOKEN", "test-token");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: any) => {
        sent.push(JSON.parse(init.body));
        return new Response(JSON.stringify({ request_id: "r1" }), { status: 200, headers: { "content-type": "application/json" } });
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("escapes every HTML-significant character", () => {
    expect(escapeEmailHtml(`<a href="x">'&`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;");
    expect(escapeEmailHtml(undefined)).toBe("");
    expect(escapeEmailHtml(3)).toBe("3");
  });

  const cases: Array<[string, () => Promise<boolean>]> = [
    ["new lead", () => notificationService.sendNewLeadNotification({ name: INJECT, email: "a@b.c", company: INJECT, phone: INJECT, message: `${INJECT}\nsecond line`, source: INJECT })],
    ["quote confirmation", () => notificationService.sendQuoteConfirmation({ email: "a@b.c", name: INJECT, quoteId: INJECT, items: [{ name: INJECT, price: 1 }], total: 1 })],
    ["ticket update", () => notificationService.sendTicketUpdate({ email: "a@b.c", name: INJECT, ticketId: INJECT, subject: INJECT, status: INJECT, message: INJECT } as any)],
    ["system alert", () => notificationService.sendSystemAlert({ type: "error", title: INJECT, message: INJECT, details: { [INJECT]: INJECT } })],
  ];

  it.each(cases)("%s: no injected markup survives in the HTML body", async (_name, send) => {
    await send();
    const html: string = sent[0].htmlbody;
    expect(html).not.toContain('<a href="https://evil.example">');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;a href=&quot;https://evil.example&quot;&gt;");
  });

  it("keeps a plain-text message's line breaks visible", async () => {
    await cases[0][1]();
    expect(sent[0].htmlbody).toMatch(/white-space: pre-wrap;">[^<]*second line/);
  });
});
