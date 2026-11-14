import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  PHONE_REGISTRY,
  PRIMARY_PHONE,
  PUBLIC_PHONE_NUMBER,
  PUBLIC_PHONE_PLACEHOLDER,
  hasPublicPhone,
  phoneAction,
  reachUsPhrase,
  schemaTelephoneProps,
} from "./companyContact";

const ROOT = join(import.meta.dirname, "..");

/**
 * Retired numbers, kept as area code / exchange / line so this file never
 * contains a match itself. None of them may appear in anything we serve.
 */
const RETIRED: ReadonlyArray<readonly [string, string, string]> = [
  ["480", "519", "5892"],
  ["855", "534", "9832"],
  ["325", "480", "9870"],
];

// Any common spelling: bare digits, dashes, dots, spaces, a bracketed area code,
// a +1 or 1 prefix, and tel: links.
const SEP = String.raw`[\s.\-\u2010-\u2013]?`;
const RETIRED_RE = new RegExp(
  RETIRED.map(([a, b, c]) => String.raw`(?<!\d)(?:\+?1${SEP})?\(?${a}\)?${SEP}${b}${SEP}${c}(?!\d)`).join("|"),
);

/** Everything a visitor, client or generated document can see. */
const SCAN_ROOTS = [
  "client/index.html",
  "client/src",
  "client/public",
  "server",
  "shared",
  "public",
  "zoho",
  "document_templates",
  "scripts/de-documents",
  "artifacts/design-concepts/resource-pdfs/content",
];
const SKIP_DIRS = new Set(["node_modules", "dist", ".git"]);
const TEXT_EXT = new Set([
  ".ts", ".tsx", ".js", ".mjs", ".cjs", ".mts", ".json", ".html", ".htm", ".css", ".txt", ".md", ".xml", ".svg", ".hbs", ".njk", ".csv", ".yml", ".yaml",
]);
const OFFICE_EXT = new Set([".docx", ".xlsx", ".pptx"]);

function walk(path: string, acc: string[] = []): string[] {
  const st = statSync(path, { throwIfNoEntry: false });
  if (!st) return acc;
  if (st.isFile()) {
    acc.push(path);
    return acc;
  }
  for (const name of readdirSync(path)) {
    if (SKIP_DIRS.has(name)) continue;
    walk(join(path, name), acc);
  }
  return acc;
}

/** Text of every XML part in an Office file, read straight from the zip central directory. */
function officeText(buf: Buffer): string {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return "";
  const entries = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out: string[] = [];
  for (let n = 0; n < entries; n++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (!/\.(xml|rels)$/.test(name)) continue;
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    const data = method === 8 ? inflateRawSync(raw) : raw;
    // Join the text between tags so a number split across Word runs still reads
    // as one string. This only reads text for the scan; nothing is rendered.
    const xml = data.toString("utf8");
    out.push(Array.from(xml.matchAll(/>([^<]*)</g), (m) => m[1]).join(""));
  }
  return out.join("\n");
}

function retiredHits(): string[] {
  const hits: string[] = [];
  for (const root of SCAN_ROOTS) {
    for (const file of walk(join(ROOT, root))) {
      const ext = extname(file).toLowerCase();
      let text: string;
      if (TEXT_EXT.has(ext)) text = readFileSync(file, "utf8");
      else if (OFFICE_EXT.has(ext)) text = officeText(readFileSync(file));
      else continue; // PDFs and images are rebuilt from the sources scanned here.
      const m = RETIRED_RE.exec(text);
      if (m) hits.push(`${relative(ROOT, file).replace(/\\/g, "/")}: ${m[0]}`);
    }
  }
  return hits;
}

describe("public phone", () => {
  it("has a single primary identity", () => {
    expect(Object.keys(PHONE_REGISTRY)).toEqual(["primary"]);
    expect(PHONE_REGISTRY.primary).toBe(PRIMARY_PHONE);
  });

  it("keeps every call link off until a real number is set", () => {
    if (PUBLIC_PHONE_NUMBER === PUBLIC_PHONE_PLACEHOLDER) {
      expect(hasPublicPhone()).toBe(false);
      expect(PRIMARY_PHONE.display).toBe("[DE_PUBLIC_PHONE]");
      expect(PRIMARY_PHONE.telHref).toBe("");
      expect(PRIMARY_PHONE.e164).toBe("");
      expect(schemaTelephoneProps()).toEqual({});
      expect(phoneAction("Call")).toBeUndefined();
      expect(reachUsPhrase()).toBe("email us at info@digeratiexperts.com");
    } else {
      expect(hasPublicPhone()).toBe(true);
      expect(PRIMARY_PHONE.telHref).toMatch(/^tel:\+1\d{10}$/);
      expect(PRIMARY_PHONE.e164).toMatch(/^\+1\d{10}$/);
      expect(schemaTelephoneProps().telephone).toMatch(/^\+1-\d{3}-\d{3}-\d{4}$/);
    }
  });

  it("matches every spelling of a retired number", () => {
    for (const [a, b, c] of RETIRED) {
      for (const s of [`${a}${b}${c}`, `${a}-${b}-${c}`, `(${a}) ${b}-${c}`, `${a}.${b}.${c}`, `+1-${a}-${b}-${c}`, `tel:+1${a}${b}${c}`, `(${a}) ${b}${c}`]) {
        expect(RETIRED_RE.test(s), s).toBe(true);
      }
    }
    expect(RETIRED_RE.test("480-555-0100")).toBe(false);
  });

  it("does not publish a retired number in any served source or document template", () => {
    expect(retiredHits()).toEqual([]);
  });
});
