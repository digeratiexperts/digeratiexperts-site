import { createPublicKey, verify } from "crypto";
import { readFile } from "fs/promises";

/**
 * The DE endpoint agent's published release, as the portal shows it.
 *
 * Releases are made offline with the Intelligence Hub's `de-release manifest`
 * (Intelligence-Hub agent/cmd/de-release). That writes a signed envelope
 * { manifest, signature, kid }: `manifest` is base64url JSON
 * (schema de.endpoint.release/v1: version, issuedAt, artifacts keyed by
 * "os/arch" with https url, sha256, size) and `signature` is ed25519 over the
 * raw manifest bytes. The Hub relays the same file to devices from
 * ENDPOINT_AGENT_RELEASE_MANIFEST.
 *
 * The portal reads the envelope from DE_AGENT_RELEASE_MANIFEST (a file path)
 * and only shows it when the signature verifies against a key in
 * DE_AGENT_RELEASE_KEYS ("kid=base64urlPublicKey,…", the line `de-release
 * keygen` prints). Unsigned, unverifiable or malformed releases are never shown
 * as downloadable; the pages say what is missing instead.
 */

export const RELEASE_SCHEMA = "de.endpoint.release/v1";
export const RELEASE_MANIFEST_ENV = "DE_AGENT_RELEASE_MANIFEST";
export const RELEASE_KEYS_ENV = "DE_AGENT_RELEASE_KEYS";

export type ReleaseArtifact = { target: string; url: string; sha256: string; size: number };
export type AgentRelease = { version: string; issuedAt: string; artifacts: ReleaseArtifact[]; kid: string };

export type ReleaseStatus =
  | { state: "not_configured"; missing: string[] }
  | { state: "invalid"; reason: string }
  | { state: "ready"; release: AgentRelease };

/** ed25519 SPKI DER prefix; the raw 32-byte key follows it. */
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

const b64url = (s: string) => Buffer.from(s.replace(/=+$/, ""), "base64url");

export function parseReleaseKeys(raw: string | undefined): Map<string, Buffer> {
  const keys = new Map<string, Buffer>();
  for (const part of (raw ?? "").split(",")) {
    const [kid, pub] = part.trim().split("=");
    if (!kid || !pub) continue;
    const bytes = b64url(pub.trim());
    if (bytes.length === 32) keys.set(kid.trim(), bytes);
  }
  return keys;
}

/** "1.2.3" only: a "-suffix" marks a pre-release, which the portal does not offer. */
const isReleaseVersion = (v: unknown) => typeof v === "string" && /^v?\d+\.\d+\.\d+$/.test(v);

export function verifyEnvelope(envelope: unknown, keys: Map<string, Buffer>): ReleaseStatus {
  const env = envelope as { manifest?: unknown; signature?: unknown; kid?: unknown } | null;
  if (!env || typeof env.manifest !== "string" || typeof env.signature !== "string" || typeof env.kid !== "string") {
    return { state: "invalid", reason: "The release file is not a signed release envelope." };
  }
  const pub = keys.get(env.kid);
  if (!pub) return { state: "invalid", reason: `The release is signed with key "${env.kid}", which is not in ${RELEASE_KEYS_ENV}.` };
  const raw = b64url(env.manifest);
  let ok = false;
  try {
    const key = createPublicKey({ key: Buffer.concat([ED25519_SPKI_PREFIX, pub]), format: "der", type: "spki" });
    ok = verify(null, raw, key, b64url(env.signature));
  } catch {
    ok = false;
  }
  if (!ok) return { state: "invalid", reason: "The release signature does not verify." };

  let m: any;
  try {
    m = JSON.parse(raw.toString("utf8"));
  } catch {
    return { state: "invalid", reason: "The signed manifest is not valid JSON." };
  }
  if (m?.schema !== RELEASE_SCHEMA || !isReleaseVersion(m.version)) {
    return { state: "invalid", reason: "The manifest is not a supported release (schema or version)." };
  }
  const artifacts: ReleaseArtifact[] = [];
  for (const [target, a] of Object.entries((m.artifacts ?? {}) as Record<string, any>)) {
    // "os/arch" builds only: "windows/amd64/helper" is the agent's own helper,
    // installed with it, never downloaded on its own.
    if (!/^[a-z0-9]+\/[a-z0-9]+$/.test(target)) continue;
    const url = typeof a?.url === "string" ? a.url : "";
    const sha256 = typeof a?.sha256 === "string" ? a.sha256.toLowerCase() : "";
    const size = typeof a?.size === "number" ? a.size : 0;
    if (!url.startsWith("https://") || !/^[0-9a-f]{64}$/.test(sha256) || size <= 0) continue;
    artifacts.push({ target, url, sha256, size });
  }
  if (artifacts.length === 0) return { state: "invalid", reason: "The manifest lists no downloadable builds." };
  artifacts.sort((a, b) => a.target.localeCompare(b.target));
  const issuedAt = typeof m.issuedAt === "string" && !Number.isNaN(Date.parse(m.issuedAt)) ? new Date(m.issuedAt).toISOString() : "";
  return { state: "ready", release: { version: String(m.version).replace(/^v/, ""), issuedAt, artifacts, kid: env.kid } };
}

export type ReleaseSource = { readEnvelope: () => Promise<unknown | null>; keys: () => Map<string, Buffer>; missing: () => string[] };

/** Production source: the env-configured file and keys. */
export function envReleaseSource(env: NodeJS.ProcessEnv = process.env): ReleaseSource {
  return {
    missing: () => [RELEASE_MANIFEST_ENV, RELEASE_KEYS_ENV].filter((k) => !env[k]?.trim()),
    keys: () => parseReleaseKeys(env[RELEASE_KEYS_ENV]),
    readEnvelope: async () => {
      const path = env[RELEASE_MANIFEST_ENV]?.trim();
      if (!path) return null;
      return JSON.parse(await readFile(path, "utf8"));
    },
  };
}

export async function readReleaseStatus(source: ReleaseSource): Promise<ReleaseStatus> {
  const missing = source.missing();
  if (missing.length) return { state: "not_configured", missing };
  let envelope: unknown;
  try {
    envelope = await source.readEnvelope();
  } catch {
    return { state: "invalid", reason: `The release file in ${RELEASE_MANIFEST_ENV} can't be read.` };
  }
  return verifyEnvelope(envelope, source.keys());
}
