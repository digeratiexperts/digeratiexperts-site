import express from "express";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readdir, rm, stat } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import {
  createDiskVaultBlobStore,
  openVaultBlob,
  registerClientVaultRoutes,
  sanitizeVaultFileName,
  sealVaultBlob,
  type VaultAuditEntry,
  type VaultBlobStore,
  type VaultItemRecord,
  type VaultMetaStore,
} from "./portalClientVault";

/**
 * Client vault over HTTP with memory stores. DE admin with MFA only; never
 * while "View as" is active; clients never; ciphertext only in the blob
 * store; ciphertext bound to its client and item; every access audited and a
 * download refused when its audit row cannot be written; fail closed without
 * a key.
 */

const KEY = "test-vault-key-0123456789abcdef0123456789abcdef";
const COMPANIES: Record<string, { companyName: string }> = {
  alamo: { companyName: "Alamo Industries" },
  globex: { companyName: "Globex" },
};
const ADMIN = { id: "u-admin", email: "admin@de.test", role: "admin" };
const ADMIN_NO_MFA = { id: "u-admin2", email: "nomfa@de.test", role: "admin" };
const VIEWING_AS = { ...ADMIN, impersonatingCompanyId: "alamo" };
const CLIENT_USER = { id: "u-ann", email: "ann@alamo.test", role: "user" };
const MFA = new Set(["u-admin"]);

const blobs = new Map<string, Buffer>();
const items = new Map<string, VaultItemRecord & { deleted?: boolean }>();
const audit: VaultAuditEntry[] = [];
let auditFails = false;

const blobStore: VaultBlobStore = {
  async put(k, d) {
    blobs.set(k, Buffer.from(d));
  },
  async get(k) {
    const b = blobs.get(k);
    if (!b) throw new Error("missing");
    return b;
  },
  async remove(k) {
    blobs.delete(k);
  },
};
const metaStore: VaultMetaStore = {
  ready: () => true,
  async list(c) {
    return [...items.values()].filter((i) => i.clientId === c && !i.deleted);
  },
  async get(c, id) {
    const i = items.get(id);
    return i && i.clientId === c && !i.deleted ? i : null;
  },
  async insert(i) {
    items.set(i.id, { ...i });
  },
  async softDelete(c, id) {
    const i = items.get(id);
    if (!i || i.clientId !== c || i.deleted) return false;
    i.deleted = true;
    return true;
  },
  async audit(e) {
    if (auditFails) throw new Error("audit down");
    audit.push(e);
  },
  async recentAudit(c) {
    return audit.filter((a) => a.clientId === c).map((a) => ({ ...a, at: new Date().toISOString() }));
  },
};

const signedInAs: express.RequestHandler = (req, res, next) => {
  const raw = req.header("x-test-user");
  (req as any).user = raw ? JSON.parse(raw) : undefined;
  if (!(req as any).user) return res.status(401).json({ error: "Sign in" });
  next();
};
const adminOnly: express.RequestHandler = (req, res, next) =>
  (req as any).user?.role === "admin" ? next() : res.status(403).json({ error: "Admin access required" });

let server: Server;
let baseUrl = "";

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  registerClientVaultRoutes(app, {
    auth: signedInAs,
    admin: adminOnly,
    getCompany: (id) => COMPANIES[id],
    hasMfa: ({ id }) => Boolean(id && MFA.has(id)),
    meta: metaStore,
    blobs: blobStore,
    rateLimit: { windowMs: 60_000, max: 1000 },
  });
  server = createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

beforeEach(() => {
  process.env.VAULT_ENCRYPTION_KEY = KEY;
  blobs.clear();
  items.clear();
  audit.length = 0;
  auditFails = false;
});

const hdr = (user: object, extra: Record<string, string> = {}) => ({ "x-test-user": JSON.stringify(user), ...extra });
const SECRET = Buffer.from("MASTER SERVICES AGREEMENT — SSN 123-45-6789", "utf8");

async function upload(user: object = ADMIN, client = "alamo", body: Buffer = SECRET, kind = "contract") {
  return fetch(`${baseUrl}/api/portal/admin/clients/${client}/vault?kind=${kind}&fileName=msa.pdf&title=MSA`, {
    method: "POST",
    headers: hdr(user, { "content-type": "application/octet-stream" }),
    body,
  });
}

describe("client vault access", () => {
  it("lets a DE admin with MFA upload, list and download, with ciphertext only at rest", async () => {
    const up = await upload();
    expect(up.status).toBe(201);
    const { item } = await up.json();
    expect(item.kind).toBe("contract");
    expect(JSON.stringify(item)).not.toMatch(/wrappedKey|objectKey|dataIv/);

    const stored = [...blobs.values()][0];
    expect(stored.includes(Buffer.from("123-45-6789"))).toBe(false);

    const list = await fetch(`${baseUrl}/api/portal/admin/clients/alamo/vault`, { headers: hdr(ADMIN) });
    expect(list.status).toBe(200);
    expect(list.headers.get("cache-control")).toBe("no-store");
    expect((await list.json()).items).toHaveLength(1);

    const dl = await fetch(`${baseUrl}/api/portal/admin/clients/alamo/vault/${item.id}/download`, { headers: hdr(ADMIN) });
    expect(dl.status).toBe(200);
    expect(dl.headers.get("content-type")).toBe("application/octet-stream");
    expect(dl.headers.get("content-disposition")).toMatch(/^attachment;/);
    expect(Buffer.from(await dl.arrayBuffer()).equals(SECRET)).toBe(true);
    expect(audit.map((a) => `${a.action}:${a.outcome}`)).toEqual(["upload:ok", "list:ok", "download:ok"]);
  });

  it("refuses the vault while viewing as a client", async () => {
    const res = await fetch(`${baseUrl}/api/portal/admin/clients/alamo/vault`, { headers: hdr(VIEWING_AS) });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("VAULT_EXIT_VIEW_AS");
    expect((await upload(VIEWING_AS)).status).toBe(403);
    expect(blobs.size).toBe(0);
    expect(audit.every((a) => a.outcome === "denied")).toBe(true);
  });

  it("refuses client users and admins without MFA", async () => {
    expect((await fetch(`${baseUrl}/api/portal/admin/clients/alamo/vault`, { headers: hdr(CLIENT_USER) })).status).toBe(403);
    const noMfa = await fetch(`${baseUrl}/api/portal/admin/clients/alamo/vault`, { headers: hdr(ADMIN_NO_MFA) });
    expect(noMfa.status).toBe(403);
    expect((await noMfa.json()).code).toBe("VAULT_MFA_REQUIRED");
    expect((await fetch(`${baseUrl}/api/portal/admin/clients/alamo/vault`)).status).toBe(401);
  });

  it("keeps each client's items to that client", async () => {
    const { item } = await (await upload()).json();
    const cross = await fetch(`${baseUrl}/api/portal/admin/clients/globex/vault/${item.id}/download`, { headers: hdr(ADMIN) });
    expect(cross.status).toBe(404);
    const del = await fetch(`${baseUrl}/api/portal/admin/clients/globex/vault/${item.id}`, { method: "DELETE", headers: hdr(ADMIN) });
    expect(del.status).toBe(404);
    expect(items.get(item.id)?.deleted).toBeFalsy();
    expect((await fetch(`${baseUrl}/api/portal/admin/clients/nope/vault`, { headers: hdr(ADMIN) })).status).toBe(404);
  });

  it("fails closed without VAULT_ENCRYPTION_KEY", async () => {
    delete process.env.VAULT_ENCRYPTION_KEY;
    const res = await upload();
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("VAULT_NOT_CONFIGURED");
    expect(blobs.size).toBe(0);
  });

  it("refuses a download whose access cannot be audited", async () => {
    const { item } = await (await upload()).json();
    auditFails = true;
    const dl = await fetch(`${baseUrl}/api/portal/admin/clients/alamo/vault/${item.id}/download`, { headers: hdr(ADMIN) });
    expect(dl.status).toBe(503);
    expect((await dl.json()).code).toBe("VAULT_AUDIT_FAILED");
  });

  it("rejects non-octet-stream uploads and unknown kinds", async () => {
    const form = await fetch(`${baseUrl}/api/portal/admin/clients/alamo/vault?kind=contract&fileName=a.txt`, {
      method: "POST",
      headers: hdr(ADMIN, { "content-type": "text/plain" }),
      body: "hello",
    });
    expect(form.status).toBe(415);
    expect((await upload(ADMIN, "alamo", SECRET, "bogus")).status).toBe(400);
  });

  it("deletes by removing the ciphertext so the item can never be opened again", async () => {
    const { item } = await (await upload()).json();
    const del = await fetch(`${baseUrl}/api/portal/admin/clients/alamo/vault/${item.id}`, { method: "DELETE", headers: hdr(ADMIN) });
    expect(del.status).toBe(200);
    expect(blobs.size).toBe(0);
    const dl = await fetch(`${baseUrl}/api/portal/admin/clients/alamo/vault/${item.id}/download`, { headers: hdr(ADMIN) });
    expect(dl.status).toBe(404);
  });
});

describe("vault crypto", () => {
  beforeEach(() => {
    process.env.VAULT_ENCRYPTION_KEY = KEY;
  });

  it("round-trips and binds ciphertext to its client and item", () => {
    const sealed = sealVaultBlob(SECRET, "alamo", "item-1");
    expect(openVaultBlob(sealed, "alamo", "item-1").equals(SECRET)).toBe(true);
    expect(() => openVaultBlob(sealed, "globex", "item-1")).toThrow();
    expect(() => openVaultBlob(sealed, "alamo", "item-2")).toThrow();
  });

  it("detects tampering and a wrong master key", () => {
    const sealed = sealVaultBlob(SECRET, "alamo", "item-1");
    const tampered = Buffer.from(sealed.ciphertext);
    tampered[0] ^= 0xff;
    expect(() => openVaultBlob({ ...sealed, ciphertext: tampered }, "alamo", "item-1")).toThrow();
    process.env.VAULT_ENCRYPTION_KEY = KEY + "-rotated";
    expect(() => openVaultBlob(sealed, "alamo", "item-1")).toThrow();
  });

  it("uses a fresh data key per item", () => {
    const a = sealVaultBlob(SECRET, "alamo", "x");
    const b = sealVaultBlob(SECRET, "alamo", "x");
    expect(a.wrappedKey).not.toBe(b.wrappedKey);
    expect(a.ciphertext.equals(b.ciphertext)).toBe(false);
  });

  it("sanitizes file names", () => {
    expect(sanitizeVaultFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeVaultFileName('in"stall<er>.exe')).toBe("in_stall_er_.exe");
    expect(sanitizeVaultFileName("")).toBe("file.bin");
  });
});

describe("disk blob store", () => {
  it("round-trips with private permissions and refuses keys outside the vault", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vault-"));
    try {
      const store = await createDiskVaultBlobStore(join(dir, "v"));
      await store.put("alamo/item-1.bin", Buffer.from("cipher"));
      expect((await store.get("alamo/item-1.bin")).toString()).toBe("cipher");
      if (process.platform !== "win32") {
        expect((await stat(join(dir, "v", "alamo", "item-1.bin"))).mode & 0o777).toBe(0o600);
      }
      await expect(store.put("../escape.bin", Buffer.from("x"))).rejects.toThrow();
      await expect(store.get("alamo/../../etc.bin")).rejects.toThrow();
      await store.remove("alamo/item-1.bin");
      expect(await readdir(join(dir, "v", "alamo"))).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
