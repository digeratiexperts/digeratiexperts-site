/**
 * Local disk spool for submitted solution requests (#243).
 *
 * A submitted solution request is never lost. When Postgres refuses the write,
 * the full record is written here as one JSON file (temp file, fsync, rename),
 * so it survives a database outage, a process restart and a deploy: the
 * production default lives in the site's shared/ directory, outside the
 * release folders. The replay worker writes each entry into Postgres once it
 * is reachable and deletes the file only after that commit.
 *
 * Files hold contact details: the directory is 0700 and each file 0600, owned
 * by the service user, never under dist/public. The spool is capped so a flood
 * cannot fill the disk; above the cap the CRM and email layers still apply.
 */
import fs from "fs";
import os from "os";
import path from "path";
import type { PublicSolutionRequest } from "./publicSolutionRequestStore";

/** One spooled record. Store quote requests (#240) reuse this spool in their own directory. */
export type SpoolEntry<R extends { id: string } = PublicSolutionRequest> = {
  version: 1;
  spooledAt: string;
  /** Set once the fallback email reached sales, so recovery does not notify twice. */
  salesEmailedAt: string | null;
  record: R;
};

type AnyEntry = SpoolEntry<{ id: string }>;

export const SPOOL_MAX_FILES = 5000;
const SAFE_ID = /^[A-Za-z0-9_-]{6,80}$/;

export function spoolDir(): string {
  if (process.env.SOLUTION_SPOOL_DIR) return path.resolve(process.env.SOLUTION_SPOOL_DIR);
  // Production runs from <site>/current; shared/ is its sibling and survives deploys.
  if (process.env.NODE_ENV === "production") {
    return path.resolve(process.cwd(), "..", "shared", "spool", "solution-requests");
  }
  return path.join(os.tmpdir(), "de-solution-spool");
}

/** Store quote requests (#240) spool beside solution requests, in their own directory. */
export function quoteSpoolDir(): string {
  if (process.env.QUOTE_SPOOL_DIR) return path.resolve(process.env.QUOTE_SPOOL_DIR);
  // Production runs from <site>/current; shared/ is its sibling and survives deploys.
  if (process.env.NODE_ENV === "production") {
    return path.resolve(process.cwd(), "..", "shared", "spool", "quote-requests");
  }
  return path.join(os.tmpdir(), "de-quote-spool");
}

/** DE Desk tickets the Desk API could not take (desk-ticket-failover), in their own directory. */
export function deskTicketSpoolDir(): string {
  if (process.env.DESK_TICKET_SPOOL_DIR) return path.resolve(process.env.DESK_TICKET_SPOOL_DIR);
  if (process.env.NODE_ENV === "production") {
    return path.resolve(process.cwd(), "..", "shared", "spool", "desk-tickets");
  }
  return path.join(os.tmpdir(), "de-desk-ticket-spool");
}

function fileFor(dir: string, id: string): string | null {
  return SAFE_ID.test(id) ? path.join(dir, `${id}.json`) : null;
}

function spoolFiles(dir: string): string[] {
  try {
    return fs.readdirSync(dir).filter((name) => name.endsWith(".json"));
  } catch {
    return [];
  }
}

function atomicWrite(file: string, data: string): void {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  const fd = fs.openSync(tmp, "wx", 0o600);
  try {
    fs.writeFileSync(fd, data);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, file);
}

/** Writes a new entry. False when the disk refuses it or the spool is full. */
export function writeSpoolEntry(entry: AnyEntry, dir: string = spoolDir()): boolean {
  const file = fileFor(dir, entry.record.id);
  if (!file) return false;
  try {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    if (!fs.existsSync(file) && spoolFiles(dir).length >= SPOOL_MAX_FILES) {
      console.error("[solution-spool] spool full; not written", { id: entry.record.id });
      return false;
    }
    atomicWrite(file, JSON.stringify(entry));
    return true;
  } catch (error: any) {
    console.error("[solution-spool] write failed:", error?.message || error);
    return false;
  }
}

/** Rewrites an existing entry in place (for example after the email was sent). */
export function updateSpoolEntry(entry: AnyEntry, dir: string = spoolDir()): boolean {
  const file = fileFor(dir, entry.record.id);
  if (!file || !fs.existsSync(file)) return false;
  try {
    atomicWrite(file, JSON.stringify(entry));
    return true;
  } catch (error: any) {
    console.error("[solution-spool] update failed:", error?.message || error);
    return false;
  }
}

export function listSpoolEntries<R extends { id: string } = PublicSolutionRequest>(
  dir: string = spoolDir(),
): SpoolEntry<R>[] {
  const entries: SpoolEntry<R>[] = [];
  for (const name of spoolFiles(dir)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")) as SpoolEntry<R>;
      if (parsed?.version === 1 && parsed.record?.id && `${parsed.record.id}.json` === name) entries.push(parsed);
      else console.error("[solution-spool] unreadable entry left in place:", name);
    } catch {
      console.error("[solution-spool] unreadable entry left in place:", name);
    }
  }
  return entries.sort((a, b) => a.spooledAt.localeCompare(b.spooledAt));
}

export function removeSpoolEntry(id: string, dir: string = spoolDir()): void {
  const file = fileFor(dir, id);
  if (!file) return;
  try {
    fs.unlinkSync(file);
  } catch {
    // Already gone.
  }
}

/** Count only: safe to expose on the health endpoint. */
export function spoolPendingCount(dir: string = spoolDir()): number {
  return spoolFiles(dir).length;
}
