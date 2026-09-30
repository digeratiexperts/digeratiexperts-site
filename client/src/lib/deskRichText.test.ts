import { describe, expect, it } from "vitest";
import { parseDeskBlocks, tokenizeDeskInline } from "./deskRichText";

describe("Ask DE reply blocks", () => {
  it("keeps plain replies as one paragraph", () => {
    expect(parseDeskBlocks("DE Desk here. Tell me what broke.")).toEqual([
      { kind: "p", lines: ["DE Desk here. Tell me what broke."] },
    ]);
  });

  it("splits paragraphs on blank lines and keeps single line breaks", () => {
    expect(parseDeskBlocks("First line\nsecond line\n\nNew paragraph")).toEqual([
      { kind: "p", lines: ["First line", "second line"] },
      { kind: "p", lines: ["New paragraph"] },
    ]);
  });

  it("turns bullet and numbered lines into lists", () => {
    expect(parseDeskBlocks("Do this now:\n- Disconnect the machine\n• Don't pay\n1. Call us\n2) Reset passwords")).toEqual([
      { kind: "p", lines: ["Do this now:"] },
      { kind: "ul", items: ["Disconnect the machine", "Don't pay"] },
      { kind: "ol", items: ["Call us", "Reset passwords"] },
    ]);
  });
});

describe("Ask DE reply inline tokens", () => {
  it("bolds **text**", () => {
    expect(tokenizeDeskInline("Call **now**, then wait")).toEqual([
      { kind: "text", text: "Call " },
      { kind: "bold", text: "now" },
      { kind: "text", text: ", then wait" },
    ]);
  });

  it("links https URLs without swallowing trailing punctuation", () => {
    const tokens = tokenizeDeskInline("Book at https://meet.digerati-experts.com/. Thanks");
    expect(tokens[1]).toEqual({
      kind: "link",
      text: "meet.digerati-experts.com",
      href: "https://meet.digerati-experts.com/",
      external: true,
    });
    expect(tokens[2]).toEqual({ kind: "text", text: ". Thanks" });
  });

  it("does not link plain http or javascript: URLs", () => {
    expect(tokenizeDeskInline("see http://example.com")).toEqual([{ kind: "text", text: "see http://example.com" }]);
    expect(tokenizeDeskInline("javascript:alert(1)")).toEqual([{ kind: "text", text: "javascript:alert(1)" }]);
  });

  it("links known site paths in the same tab", () => {
    const tokens = tokenizeDeskInline("Floors are on /pricing and /solutions/cybersecurity.");
    expect(tokens.filter((t) => t.kind === "link")).toEqual([
      { kind: "link", text: "/pricing", href: "/pricing", external: false },
      { kind: "link", text: "/solutions/cybersecurity", href: "/solutions/cybersecurity", external: false },
    ]);
  });

  it("does not link path fragments inside words or URLs", () => {
    expect(tokenizeDeskInline("and/or pricing").some((t) => t.kind === "link")).toBe(false);
    const inUrl = tokenizeDeskInline("https://digeratiexperts.com/pricing");
    expect(inUrl).toHaveLength(1);
    expect(inUrl[0]).toMatchObject({ kind: "link", external: true });
  });

  it("makes phone numbers tap-to-call", () => {
    const tokens = tokenizeDeskInline("Call 602-555-0142 or (480) 555-0100 now");
    expect(tokens.filter((t) => t.kind === "link").map((t) => (t as { href: string }).href)).toEqual([
      "tel:+16025550142",
      "tel:+14805550100",
    ]);
  });

  it("leaves longer digit runs alone", () => {
    expect(tokenizeDeskInline("ticket 16025550142123").some((t) => t.kind === "link")).toBe(false);
  });
});
