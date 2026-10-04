import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SPOOL_MAX_FILES,
  listSpoolEntries,
  removeSpoolEntry,
  spoolPendingCount,
  updateSpoolEntry,
  writeSpoolEntry,
  type SpoolEntry,
} from "./publicSolutionSpool";

const entry = (id: string, spooledAt = "2026-10-04T00:00:00.000Z"): SpoolEntry =>
  ({ version: 1, spooledAt, salesEmailedAt: null, record: { id, reference: "DE-ABC123", contactEmail: "r@example.com" } as any });

describe("solution request disk spool (#243)", () => {
  let dir: string;
  beforeEach(() => {
    dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "spool-test-")), "solution-requests");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    fs.rmSync(path.dirname(dir), { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("writes an owner-only file per request and reads it back in spool order", () => {
    expect(writeSpoolEntry(entry("req-bbbbbb", "2026-10-04T00:00:02.000Z"), dir)).toBe(true);
    expect(writeSpoolEntry(entry("req-aaaaaa", "2026-10-04T00:00:01.000Z"), dir)).toBe(true);
    expect((fs.statSync(dir).mode & 0o777).toString(8)).toBe("700");
    expect((fs.statSync(path.join(dir, "req-aaaaaa.json")).mode & 0o777).toString(8)).toBe("600");
    expect(listSpoolEntries(dir).map((e) => e.record.id)).toEqual(["req-aaaaaa", "req-bbbbbb"]);
    expect(spoolPendingCount(dir)).toBe(2);
    expect(fs.readdirSync(dir).some((name) => name.endsWith(".tmp"))).toBe(false);
  });

  it("updates in place and removes after recovery", () => {
    writeSpoolEntry(entry("req-cccccc"), dir);
    expect(updateSpoolEntry({ ...entry("req-cccccc"), salesEmailedAt: "2026-10-04T00:01:00.000Z" }, dir)).toBe(true);
    expect(listSpoolEntries(dir)[0].salesEmailedAt).toBe("2026-10-04T00:01:00.000Z");
    removeSpoolEntry("req-cccccc", dir);
    expect(spoolPendingCount(dir)).toBe(0);
    expect(updateSpoolEntry(entry("req-cccccc"), dir)).toBe(false);
  });

  it("refuses ids that could escape the directory", () => {
    expect(writeSpoolEntry(entry("../../etc/passwd"), dir)).toBe(false);
    expect(writeSpoolEntry(entry("a/b"), dir)).toBe(false);
    expect(spoolPendingCount(dir)).toBe(0);
  });

  it("leaves an unreadable file in place instead of dropping it", () => {
    writeSpoolEntry(entry("req-dddddd"), dir);
    fs.writeFileSync(path.join(dir, "req-eeeeee.json"), "{not json");
    expect(listSpoolEntries(dir).map((e) => e.record.id)).toEqual(["req-dddddd"]);
    expect(fs.existsSync(path.join(dir, "req-eeeeee.json"))).toBe(true);
  });

  it("stops accepting new files at the cap", () => {
    fs.mkdirSync(dir, { recursive: true });
    for (let i = 0; i < SPOOL_MAX_FILES; i += 1) fs.writeFileSync(path.join(dir, `fill-${String(i).padStart(6, "0")}.json`), "{}");
    expect(writeSpoolEntry(entry("req-ffffff"), dir)).toBe(false);
  });
});
