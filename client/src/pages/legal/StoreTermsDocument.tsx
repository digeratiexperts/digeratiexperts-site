import type { ReactNode } from "react";
import source from "./store-terms-of-sale.full.md?raw";

export const STORE_TERMS_OF_SALE_MARKDOWN = source.replace(/^\uFEFF/, "");

function renderInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\{\{[^}]+\}\}|\*\*[^*]+\*\*|\*[^*\n]+\*)/g;
  let last = 0;
  let i = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("{{") && token.endsWith("}}")) {
      nodes.push(
        <span
          key={`${keyBase}-ph-${i++}`}
          className="rounded-sm bg-[#F5E6C8] px-1 font-mono text-[0.95em] text-[#1A1228]"
        >
          {token}
        </span>,
      );
    } else if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(<strong key={`${keyBase}-b-${i++}`}>{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(<em key={`${keyBase}-i-${i++}`}>{token.slice(1, -1)}</em>);
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function splitRow(line: string): string[] {
  const trimmed = line.trim();
  const inner = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
  const withoutEnd = inner.endsWith("|") ? inner.slice(0, -1) : inner;
  return withoutEnd.split("|").map((cell) => cell.trim());
}

function isSeparatorRow(line: string): boolean {
  return /^\s*\|?(\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/.test(line);
}

export function StoreTermsDocument() {
  const lines = STORE_TERMS_OF_SALE_MARKDOWN.replace(/\r\n/g, "\n").split("\n");
  const body = lines.filter((line) => {
    const trimmed = line.trim();
    return !(trimmed.startsWith("<!--") && trimmed.endsWith("-->"));
  });

  const blocks: ReactNode[] = [];
  let index = 0;
  let block = 0;

  const flushParagraph = (collected: string[]) => {
    const text = collected.join(" ").trim();
    if (!text) return;
    blocks.push(
      <p key={`p-${block++}`} className="mb-6 text-[1.05rem] leading-relaxed text-[#3A3448]">
        {renderInline(text, `p-${block}`)}
      </p>,
    );
  };

  while (index < body.length) {
    const line = body[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (line.startsWith("# ")) {
      blocks.push(
        <h1 key={`h1-${block++}`} className="mb-8 text-3xl font-bold text-[#1A1228] sm:text-4xl">
          {renderInline(line.slice(2).trim(), `h1-${block}`)}
        </h1>,
      );
      index += 1;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push(
        <h2 key={`h2-${block++}`} className="mb-4 mt-10 text-2xl font-bold text-[#1A1228]">
          {renderInline(line.slice(3).trim(), `h2-${block}`)}
        </h2>,
      );
      index += 1;
      continue;
    }
    if (line.startsWith("### ")) {
      blocks.push(
        <h3 key={`h3-${block++}`} className="mb-3 mt-8 text-xl font-semibold text-[#1A1228]">
          {renderInline(line.slice(4).trim(), `h3-${block}`)}
        </h3>,
      );
      index += 1;
      continue;
    }
    if (line.trim().startsWith("|")) {
      const rows: string[][] = [];
      while (index < body.length && body[index].trim().startsWith("|")) {
        if (!isSeparatorRow(body[index])) rows.push(splitRow(body[index]));
        index += 1;
      }
      if (rows.length) {
        const header = rows[0];
        const data = rows.slice(1);
        blocks.push(
          <div key={`table-${block++}`} className="mb-8 overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-left text-sm leading-relaxed text-[#3A3448]">
              <thead>
                <tr>
                  {header.map((cell, i) => (
                    <th key={i} className="border border-[var(--de-paper-hairline)] bg-[#F7F5F2] px-3 py-2 font-semibold text-[#1A1228]">
                      {renderInline(cell, `th-${block}-${i}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, c) => (
                      <td key={c} className="border border-[var(--de-paper-hairline)] px-3 py-2 align-top">
                        {renderInline(cell, `td-${block}-${r}-${c}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
      }
      continue;
    }
    if (line.trim().startsWith("- ")) {
      const items: string[] = [];
      while (index < body.length && body[index].trim().startsWith("- ")) {
        items.push(body[index].trim().slice(2));
        index += 1;
      }
      blocks.push(
        <ul key={`ul-${block++}`} className="mb-6 list-disc space-y-3 pl-6 text-[1.05rem] leading-relaxed text-[#3A3448]">
          {items.map((item, i) => (
            <li key={i}>{renderInline(item, `li-${block}-${i}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    const collected: string[] = [];
    while (
      index < body.length &&
      body[index].trim() &&
      !body[index].startsWith("#") &&
      !body[index].trim().startsWith("|") &&
      !body[index].trim().startsWith("- ")
    ) {
      collected.push(body[index].trim());
      index += 1;
    }
    flushParagraph(collected);
  }

  return <div data-testid="store-terms-document">{blocks}</div>;
}
