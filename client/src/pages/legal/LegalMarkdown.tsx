import type { ReactNode } from "react";
import { Link } from "wouter";
import { LEGAL_DOCUMENT_HREFS } from "./legalDocumentLinks";

export type LegalSectionWrap = {
  /** Exact h2 text (without the leading ##). */
  fromHeading: string;
  /** Exclusive: wrap stops when this h2 is reached. */
  untilHeading?: string;
  id: string;
};

type InlineToken =
  | { type: "text"; value: string }
  | { type: "strong"; value: string }
  | { type: "em"; value: string }
  | { type: "link"; value: string; href: string };

type Block =
  | { type: "p"; text: string }
  | { type: "h2"; text: string; id?: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] };

const DOC_LINKS = [...LEGAL_DOCUMENT_HREFS].sort((a, b) => b.phrase.length - a.phrase.length);

export function parseLegalMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  const flushParagraph = (buf: string[]) => {
    const text = buf.join(" ").replace(/\s+/g, " ").trim();
    if (text) blocks.push({ type: "p", text });
    buf.length = 0;
  };

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i += 1;
      continue;
    }
    if (line.startsWith("## ") && !line.startsWith("### ")) {
      blocks.push({ type: "h2", text: line.slice(3).trim() });
      i += 1;
      continue;
    }
    if (line.startsWith("### ")) {
      blocks.push({ type: "h3", text: line.slice(4).trim() });
      i += 1;
      continue;
    }
    if (line.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        tableLines.push(lines[i]);
        i += 1;
      }
      const parsed = parseTable(tableLines);
      if (parsed) blocks.push(parsed);
      continue;
    }
    if (/^[-*] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(lines[i].replace(/^[-*] /, "").trim());
        i += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    }
    // Ordered list: "1. Break any law" but not "1.1 If your organization".
    if (/^\d+\. /.test(line) && !/^\d+\.\d+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i]) && !/^\d+\.\d+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, "").trim());
        i += 1;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    const buf: string[] = [line.trim()];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("#") &&
      !lines[i].startsWith("|") &&
      !/^[-*] /.test(lines[i]) &&
      !(/^\d+\. /.test(lines[i]) && !/^\d+\.\d+/.test(lines[i]))
    ) {
      buf.push(lines[i].trim());
      i += 1;
    }
    flushParagraph(buf);
  }
  return blocks;
}

function parseTable(lines: string[]): Block | null {
  const split = (line: string) =>
    line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
  if (lines.length < 2) return null;
  const headers = split(lines[0]);
  const rows = lines.slice(2).map(split);
  return { type: "table", headers, rows };
}

function tokenizeInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) tokens.push({ type: "text", value: text.slice(last, m.index) });
    if (m[1] != null) tokens.push({ type: "strong", value: m[1] });
    else tokens.push({ type: "em", value: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) tokens.push({ type: "text", value: text.slice(last) });
  return tokens.flatMap(linkifyToken);
}

function linkifyToken(token: InlineToken): InlineToken[] {
  if (token.type !== "text" && token.type !== "strong" && token.type !== "em") return [token];
  const value = token.value;
  const out: InlineToken[] = [];
  let remaining = value;
  while (remaining) {
    let best: { at: number; phrase: string; href: string } | null = null;
    for (const link of DOC_LINKS) {
      const at = remaining.indexOf(link.phrase);
      if (at === -1) continue;
      if (!best || at < best.at || (at === best.at && link.phrase.length > best.phrase.length)) {
        best = { at, phrase: link.phrase, href: link.href };
      }
    }
    if (!best) {
      out.push({ type: token.type === "text" ? "text" : token.type, value: remaining } as InlineToken);
      break;
    }
    if (best.at > 0) {
      out.push({ type: token.type === "text" ? "text" : token.type, value: remaining.slice(0, best.at) } as InlineToken);
    }
    out.push({ type: "link", value: best.phrase, href: best.href });
    remaining = remaining.slice(best.at + best.phrase.length);
  }
  return out;
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return tokenizeInline(text).map((t, i) => {
    const key = `${keyPrefix}-${i}`;
    if (t.type === "strong") return <strong key={key}>{renderInline(t.value, key)}</strong>;
    if (t.type === "em") return <em key={key}>{renderInline(t.value, key)}</em>;
    if (t.type === "link") {
      return (
        <Link key={key} href={t.href} className="underline decoration-[#A30E52]/50 underline-offset-2 hover:decoration-[#A30E52]">
          {t.value}
        </Link>
      );
    }
    return <span key={key}>{t.value}</span>;
  });
}

function headingId(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "section"
  );
}

export function LegalMarkdown({
  source,
  wrap,
}: {
  source: string;
  wrap?: LegalSectionWrap[];
}): JSX.Element {
  const blocks = parseLegalMarkdown(source);
  const wraps = wrap ?? [];

  const nodes: ReactNode[] = [];
  let i = 0;
  let key = 0;

  const renderBlock = (b: Block, k: string): ReactNode => {
    switch (b.type) {
      case "h2":
        return (
          <h2 key={k} id={b.id ?? headingId(b.text)} className="mb-4 mt-10 text-2xl font-bold text-[#1A1228]">
            {renderInline(b.text, k)}
          </h2>
        );
      case "h3":
        return (
          <h3 key={k} id={headingId(b.text)} className="mb-3 mt-8 text-xl font-semibold text-[#1A1228]">
            {renderInline(b.text, k)}
          </h3>
        );
      case "p":
        return (
          <p key={k} className="mb-4 leading-relaxed text-[#3A3448]">
            {renderInline(b.text, k)}
          </p>
        );
      case "ul":
        return (
          <ul key={k} className="mb-4 list-disc space-y-2 pl-6 text-[#3A3448]">
            {b.items.map((item, n) => (
              <li key={`${k}-${n}`}>{renderInline(item, `${k}-${n}`)}</li>
            ))}
          </ul>
        );
      case "ol":
        return (
          <ol key={k} className="mb-4 list-decimal space-y-2 pl-6 text-[#3A3448]">
            {b.items.map((item, n) => (
              <li key={`${k}-${n}`}>{renderInline(item, `${k}-${n}`)}</li>
            ))}
          </ol>
        );
      case "table":
        return (
          <div key={k} className="mb-6 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-[#3A3448]">
              <thead>
                <tr className="border-b border-[var(--de-paper-hairline)]">
                  {b.headers.map((h, n) => (
                    <th key={n} className="px-3 py-2 font-semibold text-[#1A1228]">
                      {renderInline(h, `${k}-h-${n}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((row, r) => (
                  <tr key={r} className="border-b border-[var(--de-paper-hairline)] align-top">
                    {row.map((cell, c) => (
                      <td key={c} className="px-3 py-2">
                        {renderInline(cell, `${k}-r${r}-${c}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
    }
  };

  while (i < blocks.length) {
    const b = blocks[i];
    if (b.type === "h2") {
      const match = wraps.find((w) => w.fromHeading === b.text);
      if (match) {
        const inner: ReactNode[] = [];
        // The wrap id lives on the <section>, not the heading, so the slot is a single target.
        inner.push(renderBlock(b, `w-${key++}`));
        i += 1;
        while (i < blocks.length) {
          const n = blocks[i];
          if (n.type === "h2" && match.untilHeading && n.text === match.untilHeading) break;
          // If untilHeading is omitted, include until the wrap's implicit end is not used;
          // keep consuming until the exclusive heading, or end of document.
          if (!match.untilHeading && n.type === "h2" && n.text !== b.text && wraps.some((w) => w.fromHeading === n.text && w !== match)) {
            break;
          }
          if (n.type === "h2" && match.untilHeading && n.text === match.untilHeading) break;
          inner.push(renderBlock(n, `w-${key++}`));
          i += 1;
        }
        nodes.push(
          <section key={`sec-${match.id}`} id={match.id} data-testid={`legal-section-${match.id}`}>
            {inner}
          </section>,
        );
        continue;
      }
    }
    nodes.push(renderBlock(b, `b-${key++}`));
    i += 1;
  }

  return <>{nodes}</>;
}

/** Plain text of a published body, for exact-wording tests. */
export function legalMarkdownPlainText(source: string): string {
  return parseLegalMarkdown(source)
    .map((b) => {
      switch (b.type) {
        case "p":
        case "h2":
        case "h3":
          return b.text;
        case "ul":
        case "ol":
          return b.items.join("\n");
        case "table":
          return [...b.headers, ...b.rows.map((r) => r.join(" | "))].join("\n");
      }
    })
    .join("\n");
}
