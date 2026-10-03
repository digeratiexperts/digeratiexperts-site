/**
 * Small CSV reader for the portal's staff "Import CSV" controls (VPN Access and
 * Ship Center, "manual" data source). RFC 4180: fields separated by a
 * delimiter, records by CRLF / LF / CR; a field in double quotes may hold the
 * delimiter, line breaks and "" (an escaped quote). A leading UTF-8 BOM is
 * dropped. Tab and semicolon are accepted as delimiters too, so a range
 * copied from a spreadsheet can be pasted as is.
 */

export type CsvDelimiter = "," | "\t" | ";";

export class CsvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvError";
  }
}

/** Picks the delimiter that appears most often in the first line, outside quotes. Defaults to comma. */
export function detectDelimiter(text: string): CsvDelimiter {
  const counts: Record<CsvDelimiter, number> = { ",": 0, "\t": 0, ";": 0 };
  let quoted = false;
  for (const ch of text.replace(/^﻿/, "")) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === "\n" || ch === "\r")) break;
    else if (!quoted && ch in counts) counts[ch as CsvDelimiter] += 1;
  }
  let best: CsvDelimiter = ",";
  for (const d of ["\t", ";"] as const) if (counts[d] > counts[best]) best = d;
  return best;
}

/**
 * Parses CSV text into rows of string fields. Rows whose fields are all empty
 * (blank lines, a trailing newline) are dropped. Throws CsvError on an
 * unterminated quoted field or a stray character after a closing quote.
 */
export function parseCsv(text: string, delimiter: CsvDelimiter = detectDelimiter(text)): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let started = false; // the current field has content or an opening quote
  let closedQuote = false; // the current field was quoted and its quote is closed
  let line = 1;
  let i = 0;
  const endField = () => {
    row.push(field);
    field = "";
    started = false;
    closedQuote = false;
  };
  const endRow = () => {
    endField();
    if (row.some((f) => f.trim() !== "")) rows.push(row);
    row = [];
  };

  while (i < src.length) {
    const ch = src[i];
    if (ch === delimiter) {
      endField();
      i += 1;
    } else if (ch === "\r" || ch === "\n") {
      endRow();
      i += ch === "\r" && src[i + 1] === "\n" ? 2 : 1;
      line += 1;
    } else if (closedQuote) {
      throw new CsvError(`Line ${line}: unexpected text after a closing quote.`);
    } else if (ch === '"' && !started) {
      // Quoted field: read to the closing quote; "" is a literal quote.
      const startLine = line;
      started = true;
      i += 1;
      for (;;) {
        if (i >= src.length) throw new CsvError(`Line ${startLine}: a quoted field is never closed.`);
        const c = src[i];
        if (c === '"' && src[i + 1] === '"') {
          field += '"';
          i += 2;
        } else if (c === '"') {
          i += 1;
          closedQuote = true;
          break;
        } else {
          if (c === "\n" || (c === "\r" && src[i + 1] !== "\n")) line += 1;
          field += c;
          i += 1;
        }
      }
    } else {
      field += ch;
      started = true;
      i += 1;
    }
  }
  if (started || row.length > 0) endRow();
  return rows;
}

/** "Tracking #", "tracking_number" and "TrackingNumber" all become "trackingnumber". */
export function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Accepted header names per record field (matched case-insensitively, ignoring spaces and punctuation). */
export type HeaderAliases<F extends string> = Record<F, readonly string[]>;

export type CsvRecords<F extends string> = {
  /** Fields found in the header row, in field order. */
  fields: F[];
  /** Header cells that matched no field; their columns are ignored. */
  unknownHeaders: string[];
  /** One entry per data row: trimmed values for the matched fields. */
  records: Partial<Record<F, string>>[];
};

/**
 * Reads CSV text whose first row is a header and maps columns to fields by
 * name. Throws CsvError when there is no header, no matched column, or no data row.
 */
export function readCsvRecords<F extends string>(text: string, aliases: HeaderAliases<F>): CsvRecords<F> {
  const rows = parseCsv(text);
  if (rows.length === 0) throw new CsvError("The file is empty.");
  const [header, ...body] = rows;
  const lookup = new Map<string, F>();
  for (const field of Object.keys(aliases) as F[]) {
    lookup.set(normalizeHeader(field), field);
    for (const a of aliases[field]) lookup.set(normalizeHeader(a), field);
  }
  const columns: (F | null)[] = [];
  const unknownHeaders: string[] = [];
  const seen = new Set<F>();
  for (const cell of header) {
    const f = lookup.get(normalizeHeader(cell)) ?? null;
    // The first column that maps to a field wins; a repeat is ignored.
    if (f && !seen.has(f)) {
      seen.add(f);
      columns.push(f);
    } else {
      columns.push(null);
      if (cell.trim()) unknownHeaders.push(cell.trim());
    }
  }
  if (seen.size === 0) throw new CsvError("No column header matches a field. Check the first row.");
  if (body.length === 0) throw new CsvError("The file has a header row but no data rows.");
  const records = body.map((r) => {
    const rec: Partial<Record<F, string>> = {};
    columns.forEach((f, idx) => {
      if (f) rec[f] = (r[idx] ?? "").trim();
    });
    return rec;
  });
  const fields = (Object.keys(aliases) as F[]).filter((f) => seen.has(f));
  return { fields, unknownHeaders, records };
}

export type RowError = { row: number; error: string };

/**
 * Converts each record with `convert`, which returns the data to store or an
 * error message. Row numbers are 1-based data rows (the header is not counted).
 */
export function convertRecords<R, T>(records: R[], convert: (r: R) => { data: T } | { error: string }) {
  const rows: T[] = [];
  const errors: RowError[] = [];
  records.forEach((r, i) => {
    const out = convert(r);
    if ("error" in out) errors.push({ row: i + 1, error: out.error });
    else rows.push(out.data);
  });
  return { rows, errors };
}

/**
 * A date cell as YYYY-MM-DD: "" -> "", ISO dates and date-times keep their
 * calendar date, US "M/D/YYYY" is read month first. Null when unreadable.
 */
export function toIsoDate(value: string): string | null {
  const v = value.trim();
  if (!v) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const valid = (y: number, m: number, d: number) => {
    const t = new Date(Date.UTC(y, m - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? `${y}-${pad(m)}-${pad(d)}` : null;
  };
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T ])/.exec(v);
  if (m) return valid(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:$|[ ,])/.exec(v);
  if (m) return valid(Number(m[3]), Number(m[1]), Number(m[2]));
  const t = Date.parse(v);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  return valid(d.getFullYear(), d.getMonth() + 1, d.getDate());
}
