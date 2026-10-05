/**
 * Pure checks for the Store PDF regression check (`store-pdf-check.mts`).
 * Kept free of I/O so they are unit-tested (`storePdfChecks.test.ts`).
 */
import { ACCOUNT_LIFECYCLE_STATUSES } from "../../server/integrations/tenantIdentity";
import type { PageExpectation, StorePdfCase } from "./storePdfCases";

/**
 * Account lifecycle values are never client-facing. "Pending", "Active" and
 * "Onboarding" are excluded: they are also ordinary order and service words.
 */
export const LIFECYCLE_TERMS = ACCOUNT_LIFECYCLE_STATUSES.filter((s) => !["Pending", "Active", "Onboarding"].includes(s));

/** Template leaks: an unset value, a failed number format, an unrendered placeholder. */
const LEAKS: [RegExp, string][] = [
  [/\bundefined\b/, "undefined"],
  [/\bnull\b/, "null"],
  [/\bNaN\b/, "NaN"],
  [/\bInfinity\b/, "Infinity"],
  [/\[object Object\]/, "[object Object]"],
  [/\$\{|\{\{|\}\}/, "unrendered placeholder"],
  [/&(amp|lt|gt|quot|#\d+);/, "HTML entity printed as text"],
];

/** Collapse the text layer's line breaks and runs of spaces. */
export function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function describePages(exp: PageExpectation): string {
  if ("exact" in exp) return String(exp.exact);
  return exp.max === undefined ? `${exp.min}+` : `${exp.min}-${exp.max}`;
}

export function pageProblem(pages: number, exp: PageExpectation): string | null {
  const ok = "exact" in exp ? pages === exp.exact : pages >= exp.min && (exp.max === undefined || pages <= exp.max);
  return ok ? null : `${pages} page(s), expected ${describePages(exp)}`;
}

/** Content problems in the PDF's extracted text. */
export function textProblems(rawText: string, c: Pick<StorePdfCase, "mustInclude" | "mustExclude">): string[] {
  const text = normalizeText(rawText);
  // Case-insensitive: labels and eyebrows are uppercased by CSS.
  const lower = text.toLowerCase();
  const has = (s: string) => lower.includes(normalizeText(s).toLowerCase());
  const out: string[] = [];
  for (const s of c.mustInclude) if (!has(s)) out.push(`missing text "${s}"`);
  for (const s of c.mustExclude ?? []) if (has(s)) out.push(`must not contain "${s}"`);
  for (const [re, label] of LEAKS) if (re.test(text)) out.push(`template leak: ${label}`);
  for (const term of LIFECYCLE_TERMS) {
    if (new RegExp(`\\b${term}\\b`, "i").test(text)) out.push(`account lifecycle value printed: "${term}"`);
  }
  return out;
}

const WORDS = /[\p{L}\p{N}]+/gu;

function htmlText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * True when the last page of a multi-page document holds nothing but the
 * brief close ("Next step" panel): every word on it belongs to the close, the
 * running header or the footer. The close must travel with real content.
 */
export function closeAloneOnLastPage(lastPageText: string, html: string): boolean {
  const start = html.indexOf('<table class="rec"');
  if (start < 0) return false;
  const vocab = new Set<string>();
  const add = (s: string) => {
    for (const w of s.toLowerCase().match(WORDS) ?? []) vocab.add(w);
  };
  add(htmlText(html.slice(start)));
  // Running header and footer strings from the @page margin boxes.
  for (const m of html.matchAll(/content:"((?:[^"\\]|\\.)*)"/g)) add(m[1]);
  add("page of");
  const rest = (lastPageText.toLowerCase().match(WORDS) ?? []).filter((w) => !vocab.has(w) && !/^\d+$/.test(w));
  return rest.length === 0;
}

export interface VerifyResult {
  pass: boolean;
  problems: string[];
  /** veraPDF PDF/UA-1: "pass", "FAIL", or "not run". */
  pdfua: "pass" | "FAIL" | "not run";
  fonts: string;
}

/** Per-file results from `scripts/de-documents/lib/verify.py` output, keyed by file name. */
export function parseVerifyOutput(stdout: string): Map<string, VerifyResult> {
  const out = new Map<string, VerifyResult>();
  let current: VerifyResult | null = null;
  for (const line of stdout.split("\n")) {
    const head = /^== (.+)$/.exec(line);
    if (head) {
      current = { pass: false, problems: [], pdfua: "not run", fonts: "" };
      out.set(head[1].split(/[\\/]/).pop() as string, current);
      continue;
    }
    if (!current) continue;
    const t = line.trim();
    const fonts = /fonts: (\d+ \([^)]*\))/.exec(t);
    if (fonts) current.fonts = fonts[1];
    if (t.startsWith("veraPDF PDF/UA-1:")) current.pdfua = t.endsWith("pass") ? "pass" : t.endsWith("FAIL") ? "FAIL" : "not run";
    if (t === "PASS") current.pass = true;
    if (t.startsWith("FAIL: ")) current.problems = t.slice(6).split("; ");
  }
  return out;
}

export function formatKb(bytes: number): string {
  return `${Math.round(bytes / 1024)} KB`;
}
