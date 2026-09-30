import type { ReactNode } from "react";

/**
 * Readable Ask DE replies, built as React elements from plain text — never
 * raw HTML, so nothing in a reply can inject markup.
 *
 * Understands what the advisor and a live agent actually write:
 * - paragraphs (blank-line separated) and single line breaks;
 * - bullet lines ("- ", "* ", "• ") and numbered lines ("1. ", "2) ");
 * - **bold**;
 * - https:// links (opened in a new tab), and site paths such as /pricing
 *   or /solutions/cybersecurity (same tab);
 * - US phone numbers, which become tap-to-call links.
 *
 * Anything else stays text. http:// (not https) is left as text on purpose.
 */

export type DeskInlineToken =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "link"; text: string; href: string; external: boolean };

export type DeskBlock =
  | { kind: "p"; lines: string[] }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] };

const BULLET = /^\s*(?:[-*•])\s+(.*)$/;
const NUMBERED = /^\s*\d{1,2}[.)]\s+(.*)$/;

/** Split a reply into paragraphs and lists. */
export function parseDeskBlocks(text: string): DeskBlock[] {
  const blocks: DeskBlock[] = [];
  const push = (kind: DeskBlock["kind"], value: string) => {
    const last = blocks[blocks.length - 1];
    if (kind === "p") {
      if (last?.kind === "p") last.lines.push(value);
      else blocks.push({ kind: "p", lines: [value] });
    } else if (last?.kind === kind) {
      last.items.push(value);
    } else {
      blocks.push({ kind, items: [value] });
    }
  };
  let breakPending = false;
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      breakPending = true;
      continue;
    }
    const bullet = line.match(BULLET);
    const numbered = bullet ? null : line.match(NUMBERED);
    if (breakPending && blocks[blocks.length - 1]?.kind === "p" && !bullet && !numbered) {
      blocks.push({ kind: "p", lines: [line.trim()] });
    } else if (bullet) {
      push("ul", bullet[1].trim());
    } else if (numbered) {
      push("ol", numbered[1].trim());
    } else {
      push("p", line.trim());
    }
    breakPending = false;
  }
  return blocks;
}

// One pass over the line: bold, https URLs, site paths, phone numbers.
const INLINE =
  /\*\*([^*\n]+?)\*\*|(https:\/\/[^\s<>"')\]]+[^\s<>"')\].,;:!?])|(?<![\w/.:])(\/(?:solutions|industries|resources|pricing|proactive-ecosystem-pricing|store|about|contact|book|support)(?:\/[a-z0-9-]+)*)(?![\w/])|(?<!\d)(\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4})(?!\d)/gi;

export function tokenizeDeskInline(line: string): DeskInlineToken[] {
  const out: DeskInlineToken[] = [];
  let last = 0;
  for (const m of line.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ kind: "text", text: line.slice(last, at) });
    if (m[1] !== undefined) {
      out.push({ kind: "bold", text: m[1] });
    } else if (m[2] !== undefined) {
      out.push({ kind: "link", text: m[2].replace(/^https:\/\//, "").replace(/\/$/, ""), href: m[2], external: true });
    } else if (m[3] !== undefined) {
      out.push({ kind: "link", text: m[3], href: m[3].toLowerCase(), external: false });
    } else if (m[4] !== undefined) {
      const digits = m[4].replace(/\D/g, "");
      out.push({ kind: "link", text: m[4], href: `tel:+1${digits}`, external: false });
    }
    last = at + m[0].length;
  }
  if (last < line.length) out.push({ kind: "text", text: line.slice(last) });
  return out;
}

function renderInline(line: string, onNavigate: ((path: string) => void) | undefined, keyBase: string): ReactNode[] {
  return tokenizeDeskInline(line).map((token, i) => {
    const key = `${keyBase}-${i}`;
    if (token.kind === "bold") return <strong key={key}>{token.text}</strong>;
    if (token.kind === "link") {
      if (token.external) {
        return (
          <a key={key} href={token.href} target="_blank" rel="noopener noreferrer">
            {token.text}
          </a>
        );
      }
      if (token.href.startsWith("/") && onNavigate) {
        return (
          <a
            key={key}
            href={token.href}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
              event.preventDefault();
              onNavigate(token.href);
            }}
          >
            {token.text}
          </a>
        );
      }
      return (
        <a key={key} href={token.href}>
          {token.text}
        </a>
      );
    }
    return <span key={key}>{token.text}</span>;
  });
}

export function DeskRichText({ text, onNavigate }: { text: string; onNavigate?: (path: string) => void }) {
  const blocks = parseDeskBlocks(text);
  return (
    <>
      {blocks.map((block, b) => {
        if (block.kind === "p") {
          return (
            <p key={b}>
              {block.lines.map((line, l) => (
                <span key={l}>
                  {l > 0 ? <br /> : null}
                  {renderInline(line, onNavigate, `${b}-${l}`)}
                </span>
              ))}
            </p>
          );
        }
        const List = block.kind === "ul" ? "ul" : "ol";
        return (
          <List key={b}>
            {block.items.map((item, i) => (
              <li key={i}>{renderInline(item, onNavigate, `${b}-${i}`)}</li>
            ))}
          </List>
        );
      })}
    </>
  );
}
