import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "crypto";
import express, { type Express, type NextFunction, type Request, type RequestHandler, type Response } from "express";
import { and, desc, eq, isNull } from "drizzle-orm";
import { clientVaultAudit, clientVaultItems } from "@shared/schema";
import {
  CLIENT_VAULT_KINDS,
  CLIENT_VAULT_MAX_BYTES,
  type ClientVaultItem,
  type ClientVaultKind,
} from "@shared/clientVault";

/**
 * Client vault (DE admins only).
 *
 * Contracts, provisioning scripts, vendor agent installers and PII documents a
 * DE admin keeps for one client. Rules, all enforced here on every request:
 *
 * - DE admin only (live record, via `admin`), never while "View as" is active:
 *   a token carrying impersonatingCompanyId is refused, so the client view can
 *   never reach the vault, and nothing in the client portal lists it.
 * - The admin account must have MFA turned on (live record).
 * - Bytes are encrypted before they leave the process: AES-256-GCM with a
 *   fresh 256-bit data key per item; the data key is wrapped with the master
 *   key from VAULT_ENCRYPTION_KEY. Both layers bind the client id and item id
 *   as associated data, so a ciphertext or key moved to another client or
 *   item fails to decrypt. The blob store (VAULT_STORAGE_DIR on disk, or
 *   object storage) only ever holds ciphertext.
 * - No master key, no database or no blob store means 503: fail closed,
 *   never a plaintext or in-memory fallback.
 * - Every list, upload, download, delete and refusal is written to
 *   client_vault_audit. A download whose audit row cannot be written is
 *   refused.
 * - Downloads are attachments with Cache-Control: no-store and
 *   application/octet-stream, so nothing renders on our origin and nothing is
 *   cached. The SHA-256 of the plaintext is checked before any byte is sent.
 * - Uploads must be application/octet-stream (a cross-site form cannot send
 *   that without a CORS preflight) and are capped at CLIENT_VAULT_MAX_BYTES.
 * - Per-admin rate limit on every vault route.
 */

// ---------- crypto ----------

const KEY_VERSION = 1;

export class VaultUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultUnavailableError";
  }
}

function masterKey(): Buffer {
  const configured = process.env.VAULT_ENCRYPTION_KEY?.trim();
  if (!configured || configured.length < 32) {
    throw new VaultUnavailableError("VAULT_ENCRYPTION_KEY is not set (32+ characters required)");
  }
  return createHash("sha256").update(configured, "utf8").digest();
}

export function vaultConfigured(): boolean {
  try {
    masterKey();
    return true;
  } catch {
    return false;
  }
}

const aad = (clientId: string, itemId: string, layer: "key" | "data") =>
  Buffer.from(`de-client-vault:v${KEY_VERSION}:${layer}:${clientId}:${itemId}`, "utf8");

export type SealedBlob = {
  ciphertext: Buffer;
  wrappedKey: string;
  dataIv: string;
  dataTag: string;
  sha256: string;
};

export function sealVaultBlob(plaintext: Buffer, clientId: string, itemId: string): SealedBlob {
  const kek = masterKey();
  const dek = randomBytes(32);
  try {
    const dataIv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", dek, dataIv);
    cipher.setAAD(aad(clientId, itemId, "data"));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const dataTag = cipher.getAuthTag();

    const keyIv = randomBytes(12);
    const wrap = createCipheriv("aes-256-gcm", kek, keyIv);
    wrap.setAAD(aad(clientId, itemId, "key"));
    const wrapped = Buffer.concat([wrap.update(dek), wrap.final()]);
    const wrappedKey = [keyIv, wrap.getAuthTag(), wrapped].map((b) => b.toString("base64url")).join(".");

    return {
      ciphertext,
      wrappedKey,
      dataIv: dataIv.toString("base64url"),
      dataTag: dataTag.toString("base64url"),
      sha256: createHash("sha256").update(plaintext).digest("hex"),
    };
  } finally {
    dek.fill(0);
  }
}

export function openVaultBlob(
  sealed: Omit<SealedBlob, "sha256"> & { sha256?: string },
  clientId: string,
  itemId: string,
): Buffer {
  const kek = masterKey();
  const parts = sealed.wrappedKey.split(".");
  if (parts.length !== 3) throw new Error("Invalid wrapped key");
  const [keyIv, keyTag, wrapped] = parts.map((p) => Buffer.from(p, "base64url"));
  const unwrap = createDecipheriv("aes-256-gcm", kek, keyIv);
  unwrap.setAAD(aad(clientId, itemId, "key"));
  unwrap.setAuthTag(keyTag);
  const dek = Buffer.concat([unwrap.update(wrapped), unwrap.final()]);
  try {
    const decipher = createDecipheriv("aes-256-gcm", dek, Buffer.from(sealed.dataIv, "base64url"));
    decipher.setAAD(aad(clientId, itemId, "data"));
    decipher.setAuthTag(Buffer.from(sealed.dataTag, "base64url"));
    const plaintext = Buffer.concat([decipher.update(sealed.ciphertext), decipher.final()]);
    if (sealed.sha256 && createHash("sha256").update(plaintext).digest("hex") !== sealed.sha256) {
      throw new Error("Vault item failed its integrity check");
    }
    return plaintext;
  } finally {
    dek.fill(0);
  }
}

// ---------- stores ----------

export type VaultBlobStore = {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
};

export type VaultItemRecord = ClientVaultItem & {
  objectKey: string;
  wrappedKey: string;
  keyVersion: number;
  dataIv: string;
  dataTag: string;
  sha256: string;
};

export type VaultAuditEntry = {
  clientId: string;
  itemId?: string | null;
  action: "list" | "upload" | "download" | "delete";
  outcome: "ok" | "denied" | "error";
  detail?: string | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

export type VaultMetaStore = {
  ready(): boolean;
  list(clientId: string): Promise<VaultItemRecord[]>;
  get(clientId: string, itemId: string): Promise<VaultItemRecord | null>;
  insert(item: VaultItemRecord): Promise<void>;
  softDelete(clientId: string, itemId: string, byEmail: string): Promise<boolean>;
  audit(entry: VaultAuditEntry): Promise<void>;
  recentAudit(clientId: string, limit: number): Promise<Array<VaultAuditEntry & { at: string }>>;
};

type VaultRow = typeof clientVaultItems.$inferSelect;

function rowToRecord(row: VaultRow): VaultItemRecord {
  return {
    id: row.id,
    clientId: row.clientId,
    kind: row.kind as ClientVaultKind,
    title: row.title,
    fileName: row.fileName,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    notes: row.notes ?? null,
    createdByEmail: row.createdByEmail ?? null,
    createdAt: new Date(row.createdAt).toISOString(),
    objectKey: row.objectKey,
    wrappedKey: row.wrappedKey,
    keyVersion: row.keyVersion,
    dataIv: row.dataIv,
    dataTag: row.dataTag,
    sha256: row.sha256,
  };
}

/** Postgres-backed metadata store. Not ready (503) until the DB is connected. */
export async function createDbVaultMetaStore(): Promise<VaultMetaStore> {
  const dbModule = await import("./db");
  const conn = () => (dbModule.dbReady && dbModule.db ? dbModule.db : null);
  const need = () => {
    const db = conn();
    if (!db) throw new VaultUnavailableError("Database is not connected");
    return db;
  };
  return {
    ready: () => Boolean(conn()),
    async list(clientId) {
      const rows = await need()
        .select()
        .from(clientVaultItems)
        .where(and(eq(clientVaultItems.clientId, clientId), isNull(clientVaultItems.deletedAt)))
        .orderBy(desc(clientVaultItems.createdAt));
      return rows.map(rowToRecord);
    },
    async get(clientId, itemId) {
      const [row] = await need()
        .select()
        .from(clientVaultItems)
        .where(
          and(
            eq(clientVaultItems.id, itemId),
            eq(clientVaultItems.clientId, clientId),
            isNull(clientVaultItems.deletedAt),
          ),
        )
        .limit(1);
      return row ? rowToRecord(row) : null;
    },
    async insert(item) {
      await need().insert(clientVaultItems).values({
        id: item.id,
        clientId: item.clientId,
        kind: item.kind,
        title: item.title,
        fileName: item.fileName,
        contentType: item.contentType,
        sizeBytes: item.sizeBytes,
        sha256: item.sha256,
        objectKey: item.objectKey,
        wrappedKey: item.wrappedKey,
        keyVersion: item.keyVersion,
        dataIv: item.dataIv,
        dataTag: item.dataTag,
        notes: item.notes,
        createdByEmail: item.createdByEmail,
      });
    },
    async softDelete(clientId, itemId, byEmail) {
      const rows = await need()
        .update(clientVaultItems)
        .set({ deletedAt: new Date(), deletedByEmail: byEmail })
        .where(
          and(
            eq(clientVaultItems.id, itemId),
            eq(clientVaultItems.clientId, clientId),
            isNull(clientVaultItems.deletedAt),
          ),
        )
        .returning({ id: clientVaultItems.id });
      return rows.length > 0;
    },
    async audit(entry) {
      await need().insert(clientVaultAudit).values({
        clientId: entry.clientId,
        itemId: entry.itemId ?? null,
        action: entry.action,
        outcome: entry.outcome,
        detail: entry.detail ?? null,
        actorUserId: entry.actorUserId ?? null,
        actorEmail: entry.actorEmail ?? null,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ? entry.userAgent.slice(0, 300) : null,
      });
    },
    async recentAudit(clientId, limit) {
      const rows = await need()
        .select()
        .from(clientVaultAudit)
        .where(eq(clientVaultAudit.clientId, clientId))
        .orderBy(desc(clientVaultAudit.createdAt))
        .limit(limit);
      return rows.map((r) => ({
        clientId: r.clientId,
        itemId: r.itemId,
        action: r.action as VaultAuditEntry["action"],
        outcome: r.outcome as VaultAuditEntry["outcome"],
        detail: r.detail,
        actorEmail: r.actorEmail,
        at: new Date(r.createdAt).toISOString(),
      }));
    },
  };
}

const SAFE_KEY = /^[A-Za-z0-9_-]{1,128}\/[A-Za-z0-9_-]{1,128}\.bin$/;

/**
 * Disk blob store under VAULT_STORAGE_DIR (the VPS). Ciphertext only; the
 * directory is 0700 and files 0600, written atomically. Keys are
 * `<clientId>/<itemId>.bin` and anything else is refused, so a key can never
 * climb out of the vault directory.
 */
export async function createDiskVaultBlobStore(root: string): Promise<VaultBlobStore> {
  const fs = await import("fs/promises");
  const path = await import("path");
  const base = path.resolve(root);
  await fs.mkdir(base, { recursive: true, mode: 0o700 });
  const locate = (key: string) => {
    if (!SAFE_KEY.test(key)) throw new Error("Invalid vault key");
    const full = path.resolve(base, key);
    if (!full.startsWith(base + path.sep)) throw new Error("Invalid vault key");
    return full;
  };
  return {
    async put(key, data) {
      const full = locate(key);
      await fs.mkdir(path.dirname(full), { recursive: true, mode: 0o700 });
      const tmp = `${full}.${randomUUID()}.tmp`;
      await fs.writeFile(tmp, data, { mode: 0o600, flag: "wx" });
      await fs.rename(tmp, full);
    },
    async get(key) {
      return fs.readFile(locate(key));
    },
    async remove(key) {
      await fs.rm(locate(key), { force: true });
    },
  };
}

/**
 * The blob store this server is configured for: VAULT_STORAGE_DIR (disk) when
 * set, else object storage when PRIVATE_OBJECT_DIR is set, else unavailable
 * (the vault answers 503 and stores nothing).
 */
export async function createConfiguredVaultBlobStore(): Promise<VaultBlobStore> {
  const dir = process.env.VAULT_STORAGE_DIR?.trim();
  if (dir) return createDiskVaultBlobStore(dir);
  if (process.env.PRIVATE_OBJECT_DIR?.trim()) return createObjectVaultBlobStore();
  throw new VaultUnavailableError("Set VAULT_STORAGE_DIR (or PRIVATE_OBJECT_DIR) for the client vault");
}

/** Object-storage blob store under PRIVATE_OBJECT_DIR/client-vault/. Holds ciphertext only. */
export async function createObjectVaultBlobStore(): Promise<VaultBlobStore> {
  const { objectStorageClient, ObjectStorageService } = await import(
    "./replit_integrations/object_storage/objectStorage"
  );
  const locate = (key: string) => {
    const dir = new ObjectStorageService().getPrivateObjectDir().replace(/\/+$/, "");
    const full = `${dir}/client-vault/${key}`.replace(/^\/+/, "");
    const [bucketName, ...rest] = full.split("/");
    if (!bucketName || rest.length === 0) throw new VaultUnavailableError("PRIVATE_OBJECT_DIR is not set");
    return objectStorageClient.bucket(bucketName).file(rest.join("/"));
  };
  return {
    async put(key, data) {
      await locate(key).save(data, {
        resumable: false,
        contentType: "application/octet-stream",
        metadata: { cacheControl: "no-store" },
      });
    },
    async get(key) {
      const [data] = await locate(key).download();
      return data;
    },
    async remove(key) {
      await locate(key).delete({ ignoreNotFound: true });
    },
  };
}

// ---------- routes ----------

type Caller = {
  id?: string;
  email?: string;
  role?: string | null;
  impersonatingCompanyId?: string | null;
};
type VaultRequest = Request & { userId?: string; user?: Caller };

export type ClientVaultRouteDeps = {
  auth: RequestHandler;
  admin: RequestHandler;
  getCompany: (id: string) => { companyName?: string } | undefined | null;
  /** Live MFA flag for the signed-in admin (portal auth store). */
  hasMfa: (caller: { id?: string; email?: string }) => boolean;
  meta: VaultMetaStore | (() => Promise<VaultMetaStore>);
  blobs: VaultBlobStore | (() => Promise<VaultBlobStore>);
  logSecurityEvent?: (event: string, req: any, data: Record<string, unknown>) => void;
  rateLimit?: { windowMs: number; max: number };
  now?: () => number;
};

const SAFE_NAME = /[^A-Za-z0-9._ -]+/g;
export function sanitizeVaultFileName(name: unknown): string {
  const base = String(name ?? "").split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(SAFE_NAME, "_").replace(/^\.+/, "").trim().slice(0, 120);
  return cleaned || "file.bin";
}

const cleanText = (v: unknown, max: number) =>
  String(v ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, max);

function lazy<T>(v: T | (() => Promise<T>)): () => Promise<T> {
  if (typeof v !== "function") return async () => v;
  let p: Promise<T> | null = null;
  return () => {
    p ||= (v as () => Promise<T>)().catch((err) => {
      p = null;
      throw err;
    });
    return p;
  };
}

function publicItem(r: VaultItemRecord): ClientVaultItem {
  return {
    id: r.id,
    clientId: r.clientId,
    kind: r.kind,
    title: r.title,
    fileName: r.fileName,
    contentType: r.contentType,
    sizeBytes: r.sizeBytes,
    notes: r.notes,
    createdByEmail: r.createdByEmail,
    createdAt: r.createdAt,
  };
}

export function registerClientVaultRoutes(app: Express, deps: ClientVaultRouteDeps): void {
  const getMeta = lazy(deps.meta);
  const getBlobs = lazy(deps.blobs);
  const now = deps.now ?? Date.now;
  const limit = deps.rateLimit ?? { windowMs: 10 * 60 * 1000, max: 120 };
  const hits = new Map<string, number[]>();

  const actor = (req: VaultRequest) => ({
    actorUserId: req.user?.id ?? req.userId ?? null,
    actorEmail: req.user?.email ?? null,
    ip: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  });

  const vaultGuard = (async (req: VaultRequest, res: Response, next: NextFunction) => {
    res.setHeader("Cache-Control", "no-store");
    const key = req.user?.id || req.userId || req.ip || "anon";
    const t = now();
    const recent = (hits.get(key) || []).filter((at) => t - at < limit.windowMs);
    if (recent.length >= limit.max) {
      hits.set(key, recent);
      return res.status(429).json({ code: "VAULT_RATE_LIMITED", error: "Too many vault requests. Try again shortly." });
    }
    recent.push(t);
    hits.set(key, recent);

    const clientId = String(req.params.clientId || "");
    const refuse = async (status: number, code: string, error: string) => {
      deps.logSecurityEvent?.("CLIENT_VAULT_DENIED", req, { clientId, code });
      try {
        const meta = await getMeta();
        if (meta.ready()) {
          await meta.audit({ clientId, action: "list", outcome: "denied", detail: code, ...actor(req) });
        }
      } catch {
        /* the refusal stands either way */
      }
      return res.status(status).json({ code, error });
    };

    if (req.user?.impersonatingCompanyId) {
      return refuse(403, "VAULT_EXIT_VIEW_AS", "Exit “View as” to administer client records.");
    }
    if (!deps.hasMfa({ id: req.user?.id, email: req.user?.email })) {
      return refuse(403, "VAULT_MFA_REQUIRED", "Turn on MFA for your admin account to open the client vault.");
    }
    if (!clientId || !deps.getCompany(clientId)) {
      return res.status(404).json({ error: "Company not found" });
    }
    if (!vaultConfigured()) {
      return res.status(503).json({ code: "VAULT_NOT_CONFIGURED", error: "The client vault is not configured on this server." });
    }
    try {
      const meta = await getMeta();
      if (!meta.ready()) throw new VaultUnavailableError("Database is not connected");
      await getBlobs();
    } catch {
      return res.status(503).json({ code: "VAULT_UNAVAILABLE", error: "The client vault is temporarily unavailable." });
    }
    next();
  }) as unknown as RequestHandler;

  const guards = [deps.auth, deps.admin, vaultGuard];
  const base = "/api/portal/admin/clients/:clientId/vault";

  app.get(base, guards, async (req: VaultRequest, res: Response) => {
    const clientId = req.params.clientId;
    try {
      const meta = await getMeta();
      const items = await meta.list(clientId);
      await meta.audit({ clientId, action: "list", outcome: "ok", ...actor(req) });
      const audit = await meta.recentAudit(clientId, 25);
      res.json({ items: items.map(publicItem), audit });
    } catch {
      res.status(500).json({ error: "Could not load the client vault." });
    }
  });

  app.post(
    base,
    guards,
    express.raw({ type: "application/octet-stream", limit: CLIENT_VAULT_MAX_BYTES }),
    async (req: VaultRequest, res: Response) => {
      const clientId = req.params.clientId;
      if (!req.is("application/octet-stream") || !Buffer.isBuffer(req.body)) {
        return res.status(415).json({ error: "Upload the file as application/octet-stream." });
      }
      const body = req.body as Buffer;
      if (body.length === 0) return res.status(400).json({ error: "The file is empty." });
      const kind = String(req.query.kind || "") as ClientVaultKind;
      if (!CLIENT_VAULT_KINDS.includes(kind)) {
        return res.status(400).json({ error: "kind must be one of: " + CLIENT_VAULT_KINDS.join(", ") });
      }
      const fileName = sanitizeVaultFileName(req.query.fileName);
      const title = cleanText(req.query.title, 160) || fileName;
      const notes = cleanText(req.query.notes, 1000) || null;
      const contentType = cleanText(req.query.contentType, 120) || "application/octet-stream";

      const itemId = randomUUID();
      const objectKey = `${clientId}/${itemId}.bin`;
      const meta = await getMeta();
      const blobs = await getBlobs();
      try {
        const sealed = sealVaultBlob(body, clientId, itemId);
        await blobs.put(objectKey, sealed.ciphertext);
        const record: VaultItemRecord = {
          id: itemId,
          clientId,
          kind,
          title,
          fileName,
          contentType,
          sizeBytes: body.length,
          notes,
          createdByEmail: req.user?.email ?? null,
          createdAt: new Date(now()).toISOString(),
          objectKey,
          wrappedKey: sealed.wrappedKey,
          keyVersion: KEY_VERSION,
          dataIv: sealed.dataIv,
          dataTag: sealed.dataTag,
          sha256: sealed.sha256,
        };
        try {
          await meta.insert(record);
        } catch (err) {
          await blobs.remove(objectKey).catch(() => undefined);
          throw err;
        }
        await meta
          .audit({ clientId, itemId, action: "upload", outcome: "ok", detail: `${kind}:${fileName}`, ...actor(req) })
          .catch(() => undefined);
        deps.logSecurityEvent?.("CLIENT_VAULT_UPLOAD", req, { clientId, itemId, kind });
        res.status(201).json({ item: publicItem(record) });
      } catch {
        res.status(500).json({ error: "Could not store the file." });
      }
    },
  );

  app.get(`${base}/:itemId/download`, guards, async (req: VaultRequest, res: Response) => {
    const { clientId, itemId } = req.params;
    const meta = await getMeta();
    const item = await meta.get(clientId, itemId).catch(() => null);
    if (!item) return res.status(404).json({ error: "File not found" });
    try {
      // No audit row, no file.
      await meta.audit({ clientId, itemId, action: "download", outcome: "ok", ...actor(req) });
    } catch {
      return res.status(503).json({ code: "VAULT_AUDIT_FAILED", error: "Download refused: the access could not be recorded." });
    }
    try {
      const blobs = await getBlobs();
      const ciphertext = await blobs.get(item.objectKey);
      const plaintext = openVaultBlob({ ...item, ciphertext }, clientId, itemId);
      deps.logSecurityEvent?.("CLIENT_VAULT_DOWNLOAD", req, { clientId, itemId });
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Content-Length", String(plaintext.length));
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${item.fileName.replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(item.fileName)}`,
      );
      res.end(plaintext);
    } catch {
      await meta
        .audit({ clientId, itemId, action: "download", outcome: "error", detail: "decrypt-or-read-failed", ...actor(req) })
        .catch(() => undefined);
      res.status(500).json({ error: "The file could not be opened." });
    }
  });

  app.delete(`${base}/:itemId`, guards, async (req: VaultRequest, res: Response) => {
    const { clientId, itemId } = req.params;
    const meta = await getMeta();
    try {
      const item = await meta.get(clientId, itemId);
      if (!item) return res.status(404).json({ error: "File not found" });
      const removed = await meta.softDelete(clientId, itemId, req.user?.email || "unknown");
      if (!removed) return res.status(404).json({ error: "File not found" });
      // Crypto-shred: the row keeps its wrapped key for the record, but the
      // ciphertext is removed so the item can never be opened again.
      const blobs = await getBlobs();
      await blobs.remove(item.objectKey).catch(() => undefined);
      await meta.audit({ clientId, itemId, action: "delete", outcome: "ok", ...actor(req) }).catch(() => undefined);
      deps.logSecurityEvent?.("CLIENT_VAULT_DELETE", req, { clientId, itemId });
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Could not delete the file." });
    }
  });
}
