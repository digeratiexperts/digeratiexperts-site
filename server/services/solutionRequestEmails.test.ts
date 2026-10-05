import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notificationService, solutionFallbackRecipients } from "./notificationService";

describe("solution request emails (#243)", () => {
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

  it("sends the fallback to the lead address and sales, once each", () => {
    vi.stubEnv("SALES_LEAD_EMAIL", "Sales@Example.com");
    expect(solutionFallbackRecipients()).toContain("sales@example.com");
    expect(solutionFallbackRecipients()).toHaveLength(new Set(solutionFallbackRecipients()).size);
  });

  it("escapes visitor text in the fallback email and carries the whole request", async () => {
    expect(
      await notificationService.sendSolutionRequestFallback({
        reference: "DE-ABC123",
        contactName: "<script>alert(1)</script>",
        contactEmail: "r@example.com",
        contactPhone: "480",
        organizationName: "R & Co",
        description: "Users: 12\n<img src=x onerror=alert(1)>",
      }),
    ).toBe(true);
    const mail = sent[0];
    expect(mail.htmlbody).not.toContain("<script>");
    expect(mail.htmlbody).not.toContain("<img");
    expect(mail.htmlbody).toContain("&lt;script&gt;");
    expect(mail.htmlbody).toContain("R &amp; Co");
    expect(mail.htmlbody).toContain("Users: 12");
    expect(mail.to.map((t: any) => t.email_address.address)).toEqual(solutionFallbackRecipients());
  });

  it("sends the visitor their reference, escaped", async () => {
    await notificationService.sendSolutionRequestAcknowledgement({
      reference: "DE-ABC123",
      contactName: "<b>Riley</b> Owner",
      contactEmail: "riley@example.com",
    });
    const mail = sent[0];
    expect(mail.to[0].email_address.address).toBe("riley@example.com");
    expect(mail.subject).toContain("DE-ABC123");
    expect(mail.htmlbody).toContain("DE-ABC123");
    expect(mail.htmlbody).not.toContain("<b>Riley");
  });
});
