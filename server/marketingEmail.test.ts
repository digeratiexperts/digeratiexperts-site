import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BUSINESS_POSTAL_ADDRESS_PLACEHOLDER, businessPostalAddress } from "@shared/marketingEmail";
import { logger } from "./logger";
import {
  marketingSendBlockReason,
  sendMarketingEmail,
  sendNewsletterWelcome,
  unsubscribeToken,
  unsubscribeUrl,
  verifyUnsubscribeToken,
  type OptOutStore,
} from "./marketingEmail";
import { notificationService, sendEmail, type EmailOptions } from "./services/notificationService";

const READY = {
  MARKETING_EMAIL_ENABLED: "true",
  BUSINESS_POSTAL_ADDRESS: "PO Box 0000, Example City, ZZ 00000",
  MARKETING_UNSUBSCRIBE_SECRET: "test-secret",
  APP_URL: "https://example.test",
};

function memoryStore(initial: string[] = []): OptOutStore & { rows: Map<string, string> } {
  const rows = new Map(initial.map((e) => [e, "test"]));
  return {
    rows,
    async has(email) {
      return rows.has(email);
    },
    async add(email, source) {
      rows.set(email, source);
    },
  };
}

function capture() {
  const sent: EmailOptions[] = [];
  return { sent, send: async (o: EmailOptions) => (sent.push(o), true) };
}

describe("postal address", () => {
  it("defaults to the placeholder and reads BUSINESS_POSTAL_ADDRESS", () => {
    expect(businessPostalAddress({})).toBe(BUSINESS_POSTAL_ADDRESS_PLACEHOLDER);
    expect(businessPostalAddress({ BUSINESS_POSTAL_ADDRESS: "   " })).toBe("[BUSINESS_POSTAL_ADDRESS]");
    expect(businessPostalAddress({ BUSINESS_POSTAL_ADDRESS: " PO Box 1 " })).toBe("PO Box 1");
  });
});

describe("marketing send switch", () => {
  it("is off unless MARKETING_EMAIL_ENABLED is true", () => {
    expect(marketingSendBlockReason({})).toMatch(/MARKETING_EMAIL_ENABLED/);
    expect(marketingSendBlockReason({ ...READY, MARKETING_EMAIL_ENABLED: "1" })).toMatch(/MARKETING_EMAIL_ENABLED/);
    expect(marketingSendBlockReason(READY)).toBeNull();
  });

  it("stays shut while the postal address is the placeholder, even when switched on", () => {
    const { BUSINESS_POSTAL_ADDRESS: _unset, ...rest } = READY;
    expect(marketingSendBlockReason(rest)).toMatch(/BUSINESS_POSTAL_ADDRESS/);
    expect(marketingSendBlockReason({ ...READY, BUSINESS_POSTAL_ADDRESS: BUSINESS_POSTAL_ADDRESS_PLACEHOLDER })).toMatch(
      /BUSINESS_POSTAL_ADDRESS/,
    );
  });

  it("needs a signing secret for the unsubscribe link", () => {
    const { MARKETING_UNSUBSCRIBE_SECRET: _unset, ...rest } = READY;
    expect(marketingSendBlockReason(rest)).toMatch(/secret/);
    expect(marketingSendBlockReason({ ...rest, SESSION_SECRET: "s" })).toBeNull();
  });
});

describe("sendMarketingEmail", () => {
  const email = {
    kind: "test",
    to: "Reader@Example.com",
    subject: "Hello",
    title: "Hello",
    contentHtml: "<p>Body</p>",
    contentText: "Body",
  };
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    vi.spyOn(logger, "info").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("sends nothing by default and logs why", async () => {
    const { sent, send } = capture();
    const result = await sendMarketingEmail(email, { env: {}, store: memoryStore(), send });
    expect(result).toEqual({ sent: false, reason: "MARKETING_EMAIL_ENABLED is off" });
    expect(sent).toHaveLength(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[MARKETING_EMAIL] test not sent"));
  });

  it("sends nothing with the switch on while the address is the placeholder, and logs it", async () => {
    const { sent, send } = capture();
    const result = await sendMarketingEmail(email, {
      env: { ...READY, BUSINESS_POSTAL_ADDRESS: "" },
      store: memoryStore(),
      send,
    });
    expect(result.sent).toBe(false);
    expect(sent).toHaveLength(0);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/not sent: BUSINESS_POSTAL_ADDRESS is not set/));
  });

  it("sends with the address, an unsubscribe link and one-click headers when everything is set", async () => {
    const { sent, send } = capture();
    const result = await sendMarketingEmail(email, { env: READY, store: memoryStore(), send });
    expect(result).toEqual({ sent: true });
    expect(sent).toHaveLength(1);
    const [msg] = sent;
    expect(msg.to).toBe("reader@example.com");
    const link = unsubscribeUrl("reader@example.com", READY);
    expect(link.startsWith("https://example.test/api/email/unsubscribe?t=")).toBe(true);
    expect(msg.listUnsubscribe).toEqual({ url: link });
    expect(msg.htmlBody).toContain("PO Box 0000, Example City, ZZ 00000");
    expect(msg.htmlBody).toContain(link.replace(/&/g, "&amp;"));
    expect(msg.textBody).toContain("PO Box 0000, Example City, ZZ 00000");
    expect(msg.textBody).toContain(`Unsubscribe: ${link}`);
  });

  it("skips an address on the opt-out list, whatever its case", async () => {
    const { sent, send } = capture();
    const result = await sendMarketingEmail(email, { env: READY, store: memoryStore(["reader@example.com"]), send });
    expect(result).toEqual({ sent: false, reason: "recipient opted out" });
    expect(sent).toHaveLength(0);
  });

  it("sends nothing when the opt-out list cannot be read", async () => {
    const { sent, send } = capture();
    const store: OptOutStore = {
      has: async () => {
        throw new Error("db down");
      },
      add: async () => {},
    };
    const result = await sendMarketingEmail(email, { env: READY, store, send });
    expect(result.sent).toBe(false);
    expect(sent).toHaveLength(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("opt-out list could not be checked"));
  });

  it("the newsletter welcome goes through the same checks", async () => {
    const { sent, send } = capture();
    expect((await sendNewsletterWelcome("a@b.co", { env: {}, store: memoryStore(), send })).sent).toBe(false);
    expect((await sendNewsletterWelcome("a@b.co", { env: READY, store: memoryStore(), send })).sent).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0].htmlBody).not.toMatch(/reply with Unsubscribe/i);
  });

  it("leaves no newsletter send on the transactional service", () => {
    expect("sendNewsletterWelcome" in notificationService).toBe(false);
  });
});

describe("unsubscribe tokens", () => {
  it("round-trip the lower-cased address", () => {
    const token = unsubscribeToken(" Reader@Example.com ", "k");
    expect(verifyUnsubscribeToken(token, "k")).toBe("reader@example.com");
  });

  it("reject a forged, altered or foreign token", () => {
    const token = unsubscribeToken("reader@example.com", "k");
    expect(verifyUnsubscribeToken(token, "other")).toBeNull();
    const [, sig] = token.split(".");
    const swapped = `${Buffer.from("victim@example.com").toString("base64url")}.${sig}`;
    expect(verifyUnsubscribeToken(swapped, "k")).toBeNull();
    expect(verifyUnsubscribeToken("", "k")).toBeNull();
    expect(verifyUnsubscribeToken("abc", "k")).toBeNull();
    expect(verifyUnsubscribeToken(`${token}.x`, "k")).toBeNull();
  });
});

describe("sendEmail headers", () => {
  const bodies: any[] = [];
  beforeEach(() => {
    bodies.length = 0;
    vi.stubEnv("ZEPTOMAIL_API_TOKEN", "test-token");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: any) => {
        bodies.push(JSON.parse(init.body));
        return new Response(JSON.stringify({ request_id: "r1" }), { status: 200, headers: { "content-type": "application/json" } });
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("adds RFC 8058 List-Unsubscribe headers pointing at the one-click endpoint", async () => {
    await sendEmail({ to: "a@b.co", subject: "s", htmlBody: "<p>x</p>", listUnsubscribe: { url: "https://example.test/api/email/unsubscribe?t=abc" } });
    expect(bodies[0].mime_headers).toEqual({
      "List-Unsubscribe": "<https://example.test/api/email/unsubscribe?t=abc>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });

  it("keeps transactional mail flowing with marketing switched off", async () => {
    vi.stubEnv("MARKETING_EMAIL_ENABLED", "");
    vi.stubEnv("BUSINESS_POSTAL_ADDRESS", "");
    const ok = await notificationService.sendPasswordReset({ email: "a@b.co", name: "A", resetLink: "https://example.test/r" });
    expect(ok).toBe(true);
    expect(bodies).toHaveLength(1);
    expect(bodies[0].mime_headers).toBeUndefined();
  });
});
