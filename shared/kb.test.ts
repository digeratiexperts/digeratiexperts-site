import { describe, expect, it } from "vitest";
import { formatKbNumber, inlineText, KB_NUMBER_RE, outline, parseInline, parseKbBody, safeHref } from "./kb";
import { KB_SEED } from "./kbSeed";

describe("safeHref", () => {
  it("allows http(s), mailto and portal paths only", () => {
    expect(safeHref("https://learn.microsoft.com/x")).toBe("https://learn.microsoft.com/x");
    expect(safeHref("mailto:help@example.com")).toBe("mailto:help@example.com");
    expect(safeHref("/portal/requests/license")).toBe("/portal/requests/license");
    expect(safeHref("/portal/kb?category=Licensing")).toBe("/portal/kb?category=Licensing");
    for (const bad of ["javascript:alert(1)", "JAVASCRIPT:alert(1)", "data:text/html,x", "//evil.test", "/admin", "/portal/../x\"onclick", "vbscript:x"]) {
      expect(safeHref(bad)).toBeNull();
    }
  });
});

describe("parseInline", () => {
  it("parses bold, italic, code and links, and turns an unsafe link into plain text", () => {
    const c = parseInline("**Bold** *it* `code` [ok](/portal) [bad](javascript:alert(1))");
    expect(c.map((x) => x.t)).toEqual(["strong", "text", "em", "text", "code", "text", "link", "text", "text", "text"]);
    expect(c.some((x) => x.t === "link" && x.href.startsWith("javascript"))).toBe(false);
    expect(inlineText(c)).toContain("bad");
  });
});

describe("parseKbBody", () => {
  it("builds headings, nested lists, a table, callouts, a rule and the live policy block", () => {
    const blocks = parseKbBody(
      [
        "# Introduction",
        "Some text",
        "continues here.",
        "",
        "# Steps",
        "1. First",
        "2. Second",
        "  - nested",
        "",
        "| Type | Licence |",
        "|---|---|",
        "| Frontline | F3 |",
        "",
        "> ! Careful",
        "> note",
        "---",
        "{{license-policy}}",
      ].join("\n"),
    );
    expect(blocks.map((b) => b.t)).toEqual(["h", "p", "h", "list", "table", "note", "hr", "live"]);
    const list = blocks[3] as Extract<(typeof blocks)[number], { t: "list" }>;
    expect(list.ordered).toBe(true);
    expect(list.items[1].children?.t).toBe("list");
    const note = blocks[5] as Extract<(typeof blocks)[number], { t: "note" }>;
    expect(note.tone).toBe("warn");
    expect(inlineText(note.c)).toBe("Careful note");
    expect(outline(blocks)).toEqual([
      { id: "introduction", text: "Introduction" },
      { id: "steps", text: "Steps" },
    ]);
  });

  it("gives repeated headings unique ids", () => {
    const ids = outline(parseKbBody("# Notes\n# Notes")).map((x) => x.id);
    expect(new Set(ids).size).toBe(2);
  });

  it("treats a stray pipe line as a paragraph instead of looping forever", () => {
    expect(parseKbBody("| not a table\nnext line").map((b) => b.t)).toEqual(["p"]);
  });
});

describe("built-in articles", () => {
  it("have unique, well-formed numbers and parse", () => {
    expect(formatKbNumber(7)).toBe("KB0000007");
    const numbers = KB_SEED.map((s) => s.number);
    expect(new Set(numbers).size).toBe(numbers.length);
    for (const s of KB_SEED) {
      expect(s.number).toMatch(KB_NUMBER_RE);
      expect(parseKbBody(s.body).length).toBeGreaterThan(0);
    }
  });

  it("show the licence policy live instead of stating one", () => {
    expect(KB_SEED.find((s) => s.number === "KB0000001")?.body).toContain("{{license-policy}}");
  });
});
