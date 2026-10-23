import express from "express";
import { createServer, type Server } from "http";
import { generateKeyPairSync, sign } from "crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { RELEASE_KEYS_ENV, RELEASE_MANIFEST_ENV, parseReleaseKeys, type ReleaseSource } from "./agentRelease";

/**
 * The agent release is offered only when the de-release envelope verifies
 * against a pinned key: tampered, unknown-key, pre-release, non-https and
 * unconfigured releases are never downloadable, clients never see why, and
 * the download needs a signed-in user.
 */

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const other = generateKeyPairSync("ed25519");
const rawPub = (k: typeof publicKey) => k.export({ format: "der", type: "spki" }).subarray(12).toString("base64url");
const KEYS = `k1=${rawPub(publicKey)}`;

const SHA = "a".repeat(64);
const manifest = (over: Record<string, unknown> = {}) => ({
  schema: "de.endpoint.release/v1",
  version: "0.4.2",
  issuedAt: "2026-10-20T12:00:00Z",
  artifacts: { "windows/amd64": { url: "https://downloads.example/de-agent/0.4.2/de-agent.exe", sha256: SHA, size: 7340032 } },
  ...over,
});
const envelope = (m: object, key = privateKey, kid = "k1") => {
  const raw = Buffer.from(JSON.stringify(m));
  return { manifest: raw.toString("base64url"), signature: sign(null, raw, key).toString("base64url"), kid };
};

let current: { envelope: unknown; keys: string; manifestPath: string } = { envelope: null, keys: KEYS, manifestPath: "/etc/de/release.json" };
const source: ReleaseSource = {
  missing: () => [current.manifestPath ? null : RELEASE_MANIFEST_ENV, current.keys ? null : RELEASE_KEYS_ENV].filter(Boolean) as string[],
  keys: () => parseReleaseKeys(current.keys),
  readEnvelope: async () => {
    if (current.envelope === "unreadable") throw new Error("ENOENT");
    return current.envelope;
  },
};

const signedInAs: express.RequestHandler = (req, res, next) => {
  const raw = req.header("x-test-user");
  (req as any).user = raw ? JSON.parse(raw) : undefined;
  if (!(req as any).user) return res.status(401).json({ error: "Sign in" });
  next();
};
const adminOnly: express.RequestHandler = (req, res, next) => {
  if ((req as any).user?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
};
const CLIENT = { id: "u-ann", role: "user", clientId: "acme" };
const ADMIN = { id: "u-admin", role: "admin" };

let server: Server;
let baseUrl = "";

beforeAll(async () => {
  const { registerAgentReleaseRoutes } = await import("./agentReleaseRoutes");
  const app = express();
  registerAgentReleaseRoutes(app, { guards: [signedInAs], adminGuards: [signedInAs, adminOnly], source });
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no test port");
  baseUrl = `http://127.0.0.1:${address.port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
beforeEach(() => {
  current = { envelope: envelope(manifest()), keys: KEYS, manifestPath: "/etc/de/release.json" };
});

async function get(path: string, user?: object) {
  const res = await fetch(`${baseUrl}${path}`, { redirect: "manual", headers: user ? { "x-test-user": JSON.stringify(user) } : {} });
  const text = await res.text();
  let body: any = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body, location: res.headers.get("location") };
}

describe("agent release: a verified release", () => {
  it("is offered to a signed-in user with version, hash and size", async () => {
    const r = await get("/api/portal/agent/release", CLIENT);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({
      success: true,
      available: true,
      version: "0.4.2",
      issuedAt: "2026-10-20T12:00:00.000Z",
      artifacts: [{ target: "windows/amd64", sha256: SHA, size: 7340032, downloadPath: "/api/portal/agent/download?target=windows%2Famd64" }],
    });
    // The artifact URL itself is only revealed through the signed-in redirect.
    expect(JSON.stringify(r.body)).not.toContain("downloads.example");
  });

  it("redirects a signed-in download to the build's https URL", async () => {
    const r = await get("/api/portal/agent/download?target=windows%2Famd64", CLIENT);
    expect(r.status).toBe(302);
    expect(r.location).toBe("https://downloads.example/de-agent/0.4.2/de-agent.exe");
  });

  it("needs sign-in for both the listing and the download", async () => {
    expect((await get("/api/portal/agent/release")).status).toBe(401);
    expect((await get("/api/portal/agent/download?target=windows%2Famd64")).status).toBe(401);
  });

  it("never offers the helper build on its own", async () => {
    current.envelope = envelope(
      manifest({
        artifacts: {
          "windows/amd64": { url: "https://downloads.example/a.exe", sha256: SHA, size: 10 },
          "windows/amd64/helper": { url: "https://downloads.example/h.exe", sha256: SHA, size: 5 },
        },
      }),
    );
    const r = await get("/api/portal/agent/release", CLIENT);
    expect(r.body.artifacts.map((a: any) => a.target)).toEqual(["windows/amd64"]);
    expect((await get("/api/portal/agent/download?target=windows%2Famd64%2Fhelper", CLIENT)).status).toBe(404);
  });

  it("404s a build that is not in the release", async () => {
    expect((await get("/api/portal/agent/download?target=darwin%2Farm64", CLIENT)).status).toBe(404);
  });
});

describe("agent release: never offered unless it verifies", () => {
  const cases: Array<[string, () => void, RegExp | string]> = [
    ["not configured", () => (current.manifestPath = ""), "not_configured"],
    ["no keys pinned", () => (current.keys = ""), "not_configured"],
    ["unreadable file", () => (current.envelope = "unreadable"), /can't be read/],
    ["not an envelope", () => (current.envelope = { version: "1.0.0" }), /not a signed release envelope/],
    ["signed by an unknown key", () => (current.envelope = envelope(manifest(), other.privateKey, "k9")), /k9/],
    ["signed with the wrong key under a trusted kid", () => (current.envelope = envelope(manifest(), other.privateKey, "k1")), /does not verify/],
    [
      "tampered after signing",
      () => {
        const e = envelope(manifest()) as any;
        e.manifest = Buffer.from(JSON.stringify(manifest({ version: "9.9.9" }))).toString("base64url");
        current.envelope = e;
      },
      /does not verify/,
    ],
    ["a pre-release", () => (current.envelope = envelope(manifest({ version: "0.5.0-rc1" }))), /supported release/],
    ["a wrong schema", () => (current.envelope = envelope(manifest({ schema: "other/v1" }))), /supported release/],
    [
      "only a plain-http build",
      () => (current.envelope = envelope(manifest({ artifacts: { "windows/amd64": { url: "http://x/a.exe", sha256: SHA, size: 10 } } }))),
      /no downloadable builds/,
    ],
    [
      "a build without a valid hash",
      () => (current.envelope = envelope(manifest({ artifacts: { "windows/amd64": { url: "https://x/a.exe", sha256: "abc", size: 10 } } }))),
      /no downloadable builds/,
    ],
  ];

  for (const [name, setup, expected] of cases) {
    it(name, async () => {
      setup();
      const client = await get("/api/portal/agent/release", CLIENT);
      expect(client.body).toEqual({ success: true, available: false });
      expect((await get("/api/portal/agent/download?target=windows%2Famd64", CLIENT)).status).toBe(404);
      const admin = await get("/api/portal/admin/agent-release", ADMIN);
      const status = admin.body.status;
      if (expected === "not_configured") expect(status.state).toBe("not_configured");
      else {
        expect(status.state).toBe("invalid");
        expect(status.reason).toMatch(expected);
      }
    });
  }

  it("names the missing settings for DE admins only", async () => {
    current.manifestPath = "";
    current.keys = "";
    expect((await get("/api/portal/admin/agent-release", ADMIN)).body.status).toEqual({
      state: "not_configured",
      missing: [RELEASE_MANIFEST_ENV, RELEASE_KEYS_ENV],
    });
    expect((await get("/api/portal/admin/agent-release", CLIENT)).status).toBe(403);
  });
});
