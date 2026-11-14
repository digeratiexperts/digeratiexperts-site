import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BUSINESS_POSTAL_ADDRESS_PLACEHOLDER, businessPostalAddress } from "@shared/marketingEmail";
import { logger } from "./logger";
import {
  exportSuppressions,
  marketingSendBlockReason,
  sendMarketingEmail,
  sendNewsletterWelcome,
  unsubscribeToken,
  suppressionsCsv,
  unsubscribeUrl,
  verifyUnsubscribeToken,
  verifyUnsubscribeTokenFromEnv,
  type MarketingMessage,
  type MarketingSender,
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
    async list() {
      return [...rows].map(([email, source]) => ({ email, source, optedOutAt: "2026-11-01T00:00:00.000Z" }));
    },
  };
}

function bulkSender(): MarketingSender & { sent: MarketingMessage[] } {
  const sent: MarketingMessage[] = [];
  return { name: "fake bulk", sent, unavailableReason: () => null, send: async (m) => (sent.push(m), true) };
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

  it("needs the dedicated unsubscribe secret; the session secret and the previous key do not count", () => {
    const { MARKETING_UNSUBSCRIBE_SECRET: _unset, ...rest } = READY;
    expect(marketingSendBlockReason(rest)).toBe("MARKETING_UNSUBSCRIBE_SECRET is not set");
    expect(marketingSendBlockReason({ ...rest, SESSION_SECRET: "s" })).toBe("MARKETING_UNSUBSCRIBE_SECRET is not set");
    expect(marketingSendBlockReason({ ...rest, MARKETING_UNSUBSCRIBE_SECRET_PREVIOUS: "old" })).toBe(
      "MARKETING_UNSUBSCRIBE_SECRET is not set",
    );
    expect(() => unsubscribeUrl("a@b.co", { ...rest, SESSION_SECRET: "s" })).toThrow();
  });
});

describe("sendMarketingEmail", () => {
  const email = {
    purpose: "signup-welcome" as const,
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
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[MARKETING_EMAIL] signup-welcome not sent"));
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
    expect(msg.purpose).toBe("signup-welcome");
    expect(msg.htmlBody).toContain("PO Box 0000, Example City, ZZ 00000");
    expect(msg.htmlBody).toContain(link.replace(/&/g, "&amp;"));
    expect(msg.textBody).toContain("PO Box 0000, Example City, ZZ 00000");
    expect(msg.textBody).toContain(`Unsubscribe: ${link}`);
  });

  it.each(["newsletter", "campaign", "promotion"] as const)(
    "refuses a %s with no bulk sender configured and never touches the transactional sender",
    async (purpose) => {
      const { sent, send } = capture();
      const result = await sendMarketingEmail({ ...email, purpose }, { env: READY, store: memoryStore(), send });
      expect(result.sent).toBe(false);
      expect(sent).toHaveLength(0);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(`[MARKETING_EMAIL] ${purpose} not sent: no bulk marketing sender`));
    },
  );

  it("hands a campaign to the bulk sender, with the footer and unsubscribe link, never to ZeptoMail", async () => {
    const { sent, send } = capture();
    const bulk = bulkSender();
    const result = await sendMarketingEmail({ ...email, purpose: "campaign" }, { env: READY, store: memoryStore(), send, marketingSender: bulk });
    expect(result).toEqual({ sent: true });
    expect(sent).toHaveLength(0);
    expect(bulk.sent).toHaveLength(1);
    expect(bulk.sent[0].unsubscribeUrl).toBe(unsubscribeUrl("reader@example.com", READY));
    expect(bulk.sent[0].htmlBody).toContain("PO Box 0000, Example City, ZZ 00000");
  });

  it("the bulk sender also skips opted-out addresses", async () => {
    const bulk = bulkSender();
    const result = await sendMarketingEmail(
      { ...email, purpose: "newsletter" },
      { env: READY, store: memoryStore(["reader@example.com"]), marketingSender: bulk },
    );
    expect(result).toEqual({ sent: false, reason: "recipient opted out" });
    expect(bulk.sent).toHaveLength(0);
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
      list: async () => [],
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

describe("unsubscribe secret rotation", () => {
  it("a link signed with the previous key still verifies, but new links use the current key", () => {
    const old = unsubscribeToken("reader@example.com", "old-key");
    const env = { ...READY, MARKETING_UNSUBSCRIBE_SECRET: "new-key", MARKETING_UNSUBSCRIBE_SECRET_PREVIOUS: "old-key" };
    expect(verifyUnsubscribeTokenFromEnv(old, env)).toBe("reader@example.com");
    const fresh = new URL(unsubscribeUrl("reader@example.com", env)).searchParams.get("t")!;
    expect(verifyUnsubscribeToken(fresh, "new-key")).toBe("reader@example.com");
    expect(verifyUnsubscribeToken(fresh, "old-key")).toBeNull();
  });

  it("a link stops verifying once the previous key is dropped", () => {
    const old = unsubscribeToken("reader@example.com", "old-key");
    expect(verifyUnsubscribeTokenFromEnv(old, { ...READY, MARKETING_UNSUBSCRIBE_SECRET: "new-key" })).toBeNull();
  });

  it("rotating SESSION_SECRET does not break links already sent", () => {
    const before = { ...READY, SESSION_SECRET: "session-a" };
    const after = { ...READY, SESSION_SECRET: "session-b" };
    const token = new URL(unsubscribeUrl("reader@example.com", before)).searchParams.get("t")!;
    expect(verifyUnsubscribeTokenFromEnv(token, after)).toBe("reader@example.com");
  });
});

describe("suppression export", () => {
  it("returns every opt-out, and as CSV", async () => {
    const store = memoryStore(["a@example.com", "b@example.com"]);
    const exported = await exportSuppressions(store);
    expect(exported.count).toBe(2);
    expect(exported.records.map((r) => r.email)).toEqual(["a@example.com", "b@example.com"]);
    expect(suppressionsCsv(exported.records)).toBe(
      "email,source,opted_out_at\na@example.com,test,2026-11-01T00:00:00.000Z\nb@example.com,test,2026-11-01T00:00:00.000Z\n",
    );
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
    await sendEmail({
      to: "a@b.co",
      subject: "s",
      htmlBody: "<p>x</p>",
      purpose: "signup-welcome",
      listUnsubscribe: { url: "https://example.test/api/email/unsubscribe?t=abc" },
    });
    expect(bodies[0].mime_headers).toEqual({
      "List-Unsubscribe": "<https://example.test/api/email/unsubscribe?t=abc>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });

  it.each(["newsletter", "campaign", "promotion"] as const)("refuses %s mail on the transactional sender and logs it", async (purpose) => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    const ok = await sendEmail({ to: "a@b.co", subject: "Big sale", htmlBody: "<p>x</p>", purpose });
    expect(ok).toBe(false);
    expect(bodies).toHaveLength(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`[EMAIL] refused ${purpose} mail`), expect.anything());
    warn.mockRestore();
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
