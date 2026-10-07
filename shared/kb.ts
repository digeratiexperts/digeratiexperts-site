/**
 * Knowledge base articles: numbering, the API shapes, and a small, safe
 * Markdown dialect for article bodies. The parser produces a block tree the
 * client renders with React (no HTML strings, no dangerouslySetInnerHTML), and
 * links are limited to http(s), mailto and portal paths.
 *
 * Supported: # / ## / ### headings, paragraphs, **bold**, *italic*, `code`,
 * [links](...), "-"/"*" bullets and "1." numbered lists (nest with 2 spaces),
 * | tables | with a |---| separator, "> " notes ("> !" for a warning),
 * "---" rules, and the live block {{license-policy}} (the reader's own
 * company licence policy tables).
 */

export function formatKbNumber(n: number): string {
  return `KB${String(n).padStart(7, "0")}`;
}

export const KB_NUMBER_RE = /^KB\d{7}$/;

export const KB_CATEGORIES = [
  "Getting started",
  "Access & accounts",
  "Licensing",
  "Email & Microsoft 365",
  "Security",
  "Devices",
  "Network & VPN",
  "Phones",
  "Remote access",
] as const;

export type KbRating = { average: number; count: number };

export type KbArticleSummary = {
  id: string;
  number: string;
  title: string;
  summary: string;
  category: string;
  tags: string[];
  status: "draft" | "published";
  audience: "all" | "company";
  revisedByName: string;
  revisedAt: string;
  views: number;
  rating: KbRating;
  readMinutes: number;
};

export type KbArticle = KbArticleSummary & {
  body: string;
  myRating: number | null;
  subscribed: boolean;
};

export function readMinutes(body: string): number {
  const words = body.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

// ---------- body parser ----------

export type Inline =
  | { t: "text"; v: string }
  | { t: "strong"; c: Inline[] }
  | { t: "em"; c: Inline[] }
  | { t: "code"; v: string }
  | { t: "link"; href: string; c: Inline[] };

export type ListItem = { c: Inline[]; children: Block | null };

export type Block =
  | { t: "h"; level: 2 | 3 | 4; c: Inline[]; id: string }
  | { t: "p"; c: Inline[] }
  | { t: "list"; ordered: boolean; items: ListItem[] }
  | { t: "table"; head: Inline[][]; rows: Inline[][][] }
  | { t: "note"; tone: "info" | "warn"; c: Inline[] }
  | { t: "hr" }
  | { t: "live"; name: "license-policy" };

export function safeHref(href: string): string | null {
  const h = href.trim();
  if (/^https?:\/\/[^\s"'<>]+$/i.test(h)) return h;
  if (/^mailto:[^\s"'<>]+$/i.test(h)) return h;
  if (/^\/portal(\/[A-Za-z0-9\-_/]*)?(\?[A-Za-z0-9\-_=&%.+]*)?(#[A-Za-z0-9\-_]*)?$/.test(h)) return h;
  return null;
}

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let buf = "";
  const flush = () => {
    if (buf) out.push({ t: "text", v: buf });
    buf = "";
  };
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    let m: RegExpMatchArray | null;
    if ((m = rest.match(/^`([^`]+)`/))) {
      flush();
      out.push({ t: "code", v: m[1] });
      i += m[0].length;
    } else if ((m = rest.match(/^\*\*(.+?)\*\*/))) {
      flush();
      out.push({ t: "strong", c: parseInline(m[1]) });
      i += m[0].length;
    } else if ((m = rest.match(/^\*([^*\s][^*]*?)\*/))) {
      flush();
      out.push({ t: "em", c: parseInline(m[1]) });
      i += m[0].length;
    } else if ((m = rest.match(/^\[([^\]]+)\]\(([^)\s]+)\)/))) {
      flush();
      const href = safeHref(m[2]);
      if (href) out.push({ t: "link", href, c: parseInline(m[1]) });
      else out.push({ t: "text", v: m[1] });
      i += m[0].length;
    } else {
      buf += src[i];
      i += 1;
    }
  }
  flush();
  return out;
}

export function inlineText(c: Inline[]): string {
  return c.map((x) => (x.t === "text" || x.t === "code" ? x.v : inlineText(x.c))).join("");
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "section";
}

const LIST_RE = /^(\s*)([-*]|\d+\.)\s+(.*)$/;

function parseList(lines: string[], start: number, indent: number): { block: Block; next: number } {
  const first = lines[start].match(LIST_RE)!;
  const ordered = /\d/.test(first[2]);
  const items: ListItem[] = [];
  let i = start;
  while (i < lines.length) {
    const m = lines[i].match(LIST_RE);
    if (!m) break;
    const ind = m[1].replace(/\t/g, "  ").length;
    if (ind < indent) break;
    if (ind > indent) {
      const nested = parseList(lines, i, ind);
      if (items.length) items[items.length - 1].children = nested.block;
      i = nested.next;
      continue;
    }
    items.push({ c: parseInline(m[3]), children: null });
    i += 1;
  }
  return { block: { t: "list", ordered, items }, next: i };
}

function cells(row: string): string[] {
  return row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

export function parseKbBody(body: string): Block[] {
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  const ids = new Set<string>();
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      i += 1;
      continue;
    }
    let m: RegExpMatchArray | null;
    if (trimmed === "{{license-policy}}") {
      blocks.push({ t: "live", name: "license-policy" });
      i += 1;
    } else if (/^-{3,}$/.test(trimmed)) {
      blocks.push({ t: "hr" });
      i += 1;
    } else if ((m = trimmed.match(/^(#{1,3})\s+(.*)$/))) {
      // Article title is the page h1, so body headings start at h2.
      const level = (m[1].length + 1) as 2 | 3 | 4;
      let id = slug(m[2]);
      while (ids.has(id)) id += "-x";
      ids.add(id);
      blocks.push({ t: "h", level, c: parseInline(m[2]), id });
      i += 1;
    } else if (LIST_RE.test(line)) {
      const { block, next } = parseList(lines, i, line.match(LIST_RE)![1].length);
      blocks.push(block);
      i = next;
    } else if (trimmed.startsWith("|") && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) {
      const head = cells(trimmed).map(parseInline);
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(cells(lines[i]).map(parseInline));
        i += 1;
      }
      blocks.push({ t: "table", head, rows });
    } else if (trimmed.startsWith(">")) {
      const parts: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        parts.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      let text = parts.join(" ");
      const warn = text.startsWith("!");
      if (warn) text = text.slice(1).trim();
      blocks.push({ t: "note", tone: warn ? "warn" : "info", c: parseInline(text) });
    } else {
      // The first line is always consumed (a stray "|" line is a paragraph), so the loop advances.
      const parts: string[] = [trimmed];
      i += 1;
      while (
        i < lines.length &&
        lines[i].trim() &&
        !LIST_RE.test(lines[i]) &&
        !/^(#{1,3})\s/.test(lines[i].trim()) &&
        !lines[i].trim().startsWith("|") &&
        !lines[i].trim().startsWith(">") &&
        lines[i].trim() !== "{{license-policy}}" &&
        !/^-{3,}$/.test(lines[i].trim())
      ) {
        parts.push(lines[i].trim());
        i += 1;
      }
      blocks.push({ t: "p", c: parseInline(parts.join(" ")) });
    }
  }
  return blocks;
}

/** The h2 headings, for an "On this page" list. */
export function outline(blocks: Block[]): Array<{ id: string; text: string }> {
  return blocks.filter((b): b is Extract<Block, { t: "h" }> => b.t === "h" && b.level === 2).map((b) => ({ id: b.id, text: inlineText(b.c) }));
}
