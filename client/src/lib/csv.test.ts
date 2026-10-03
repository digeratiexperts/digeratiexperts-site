import { describe, expect, it } from "vitest";
import { convertRecords, CsvError, detectDelimiter, normalizeHeader, parseCsv, readCsvRecords, toIsoDate } from "./csv";

describe("parseCsv (RFC 4180)", () => {
  it("splits fields and records with CRLF, LF and CR", () => {
    expect(parseCsv("a,b,c\r\n1,2,3\n4,5,6\r7,8,9")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
      ["4", "5", "6"],
      ["7", "8", "9"],
    ]);
  });

  it("reads quoted fields holding commas, line breaks and escaped quotes", () => {
    expect(parseCsv('name,notes\r\n"Laptop, front desk","Line one\r\nline two"\n"Say ""hi""",""')).toEqual([
      ["name", "notes"],
      ["Laptop, front desk", "Line one\r\nline two"],
      ['Say "hi"', ""],
    ]);
  });

  it("keeps empty fields, drops blank lines and a trailing newline, strips a BOM", () => {
    expect(parseCsv("﻿a,b,c\n1,,3\n\n,,\n4,5,\n")).toEqual([
      ["a", "b", "c"],
      ["1", "", "3"],
      ["4", "5", ""],
    ]);
  });

  it("keeps a quote in the middle of an unquoted field as text", () => {
    expect(parseCsv('a\n12" monitor')).toEqual([["a"], ['12" monitor']]);
  });

  it("rejects an unterminated quote and text after a closing quote", () => {
    expect(() => parseCsv('a\n"open')).toThrow(CsvError);
    expect(() => parseCsv('a\n"open')).toThrow(/Line 2/);
    expect(() => parseCsv('a,b\n"x"y,2')).toThrow(/after a closing quote/);
  });

  it("detects tab and semicolon delimiters from the header row", () => {
    expect(detectDelimiter("a\tb\tc\n1,2\t3")).toBe("\t");
    expect(detectDelimiter("a;b;c")).toBe(";");
    expect(detectDelimiter('"a,b";c;d')).toBe(";");
    expect(detectDelimiter("single")).toBe(",");
    expect(parseCsv("Name\tUser\nLaptop\tana@acme.test")).toEqual([
      ["Name", "User"],
      ["Laptop", "ana@acme.test"],
    ]);
  });
});

describe("readCsvRecords", () => {
  const aliases = {
    trackingNumber: ["tracking", "tracking #", "tracking number"],
    carrier: [],
    shippedAt: ["ship date", "shipped"],
  } as const;

  it("maps headers case-insensitively, ignoring spaces and punctuation", () => {
    const out = readCsvRecords("Tracking #,CARRIER,Ship Date,Weight\n 1Z999 ,UPS,2026-10-01,2 lb\n9400,USPS,,", aliases);
    expect(out.fields).toEqual(["trackingNumber", "carrier", "shippedAt"]);
    expect(out.unknownHeaders).toEqual(["Weight"]);
    expect(out.records).toEqual([
      { trackingNumber: "1Z999", carrier: "UPS", shippedAt: "2026-10-01" },
      { trackingNumber: "9400", carrier: "USPS", shippedAt: "" },
    ]);
  });

  it("uses the first column for a field named twice and fills short rows with empty values", () => {
    const out = readCsvRecords("tracking,tracking number,carrier\nA,B", aliases);
    expect(out.records).toEqual([{ trackingNumber: "A", carrier: "" }]);
    expect(out.unknownHeaders).toEqual(["tracking number"]);
  });

  it("explains an empty file, an unmatched header and a header with no rows", () => {
    expect(() => readCsvRecords("", aliases)).toThrow(/empty/);
    expect(() => readCsvRecords("foo,bar\n1,2", aliases)).toThrow(/No column header/);
    expect(() => readCsvRecords("carrier\n", aliases)).toThrow(/no data rows/);
  });

  it("normalizes header names", () => {
    expect(normalizeHeader(" Last-Seen (UTC) ")).toBe("lastseenutc");
  });
});

describe("convertRecords", () => {
  it("collects converted rows and 1-based row errors", () => {
    const out = convertRecords([{ n: "a" }, { n: "" }, { n: "c" }], (r) => (r.n ? { data: r.n.toUpperCase() } : { error: "name missing" }));
    expect(out.rows).toEqual(["A", "C"]);
    expect(out.errors).toEqual([{ row: 2, error: "name missing" }]);
  });
});

describe("toIsoDate", () => {
  it("reads ISO, US and date-time cells as a calendar date", () => {
    expect(toIsoDate("")).toBe("");
    expect(toIsoDate("2026-10-03")).toBe("2026-10-03");
    expect(toIsoDate("2026-10-03T23:30:00Z")).toBe("2026-10-03");
    expect(toIsoDate("2026-1-5")).toBe("2026-01-05");
    expect(toIsoDate("10/3/2026")).toBe("2026-10-03");
    expect(toIsoDate("10/03/2026 4:15 PM")).toBe("2026-10-03");
  });

  it("refuses impossible or unreadable dates", () => {
    expect(toIsoDate("2026-02-30")).toBeNull();
    expect(toIsoDate("13/01/2026")).toBeNull();
    expect(toIsoDate("yesterday")).toBeNull();
  });
});
