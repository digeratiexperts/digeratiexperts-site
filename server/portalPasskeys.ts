/**
 * Passkeys (WebAuthn Level 3) for the client portal, tuned for four providers:
 * Apple (iCloud Keychain / Passwords app), Android (Google Password Manager),
 * Microsoft Authenticator and JumpCloud (JumpCloud Password Manager).
 *
 * Written on node:crypto so it carries no third-party verifier. Scope:
 * - attestation "none": no vendor attestation is trusted or required, which is what
 *   synced consumer passkeys send. The provider is recognised from the AAGUID when
 *   the authenticator reports one, otherwise from the provider the user picked.
 * - user verification required (Face ID, Touch ID, fingerprint, device PIN).
 * - discoverable credentials, ES256 / EdDSA / RS256.
 */
import { createHash, createPublicKey, randomBytes, timingSafeEqual, verify as cryptoVerify } from "crypto";

export type PasskeyProviderId = "apple" | "android" | "microsoft" | "jumpcloud";

export type StoredPasskey = {
  /** Credential id, base64url. */
  id: string;
  /** SubjectPublicKeyInfo DER, base64url. */
  publicKey: string;
  /** COSE algorithm: -7 ES256, -8 EdDSA, -257 RS256. */
  algorithm: number;
  signCount: number;
  transports: string[];
  aaguid: string;
  rpId: string;
  provider: PasskeyProviderId | "other";
  providerLabel: string;
  nickname: string;
  /** Backup eligible: the provider syncs it (iCloud Keychain, Google Password Manager, ...). */
  backupEligible: boolean;
  createdAt: string;
  lastUsedAt: string | null;
};

type ProviderProfile = {
  label: string;
  /** Where the passkey lives, in the provider's own words. */
  store: string;
  aaguids: string[];
};

/**
 * AAGUIDs are from the community passkey-authenticator-aaguids registry.
 * JumpCloud does not publish one there, so JumpCloud passkeys are recognised from
 * the provider the user picked.
 */
export const PASSKEY_PROVIDERS: Record<PasskeyProviderId, ProviderProfile> = {
  apple: {
    label: "Apple",
    store: "iCloud Keychain (Passwords app)",
    aaguids: ["fbfc3007-154e-4ecc-8c0b-6e020557d7bd", "dd4ec289-e01d-41c9-bb89-70fa845d4bf2"],
  },
  android: {
    label: "Android",
    store: "Google Password Manager",
    aaguids: ["ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4"],
  },
  microsoft: {
    label: "Microsoft Authenticator",
    store: "Microsoft Authenticator",
    aaguids: ["90a3ccdf-635c-4729-a248-9b709135078f", "de1e552d-db1d-4423-a619-566b625cdc84"],
  },
  jumpcloud: {
    label: "JumpCloud",
    store: "JumpCloud Password Manager",
    aaguids: [],
  },
};

/** Other providers a user may pick in the OS sheet anyway; labelled, never rejected. */
const OTHER_AAGUIDS: Record<string, string> = {
  "08987058-cadc-4b81-b6e1-30de50dcbe96": "Windows Hello",
  "9ddd1817-af5a-4672-a2b9-3e3dd95000a9": "Windows Hello",
  "6028b017-b1d4-4c02-b4b3-afcdafc96bb2": "Windows Hello",
  "53414d53-554e-4700-0000-000000000000": "Samsung Pass",
  "bada5566-a7aa-401f-bd96-45619a55120d": "1Password",
};

export function isPasskeyProvider(value: unknown): value is PasskeyProviderId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(PASSKEY_PROVIDERS, value);
}

const SUPPORTED_ALGORITHMS = [-7, -8, -257];
const ZERO_AAGUID = "00000000-0000-0000-0000-000000000000";

export const b64url = {
  encode: (bytes: Buffer | Uint8Array) => Buffer.from(bytes).toString("base64url"),
  decode: (value: string) => Buffer.from(String(value || ""), "base64url"),
};

export function newChallenge(): string {
  return b64url.encode(randomBytes(32));
}

// ---------------------------------------------------------------------------
// Relying party

/**
 * One passkey works on digeratiexperts.com and every subdomain (portal., store.)
 * because the RP ID is the registrable domain. WEBAUTHN_RP_ID overrides it.
 */
export function resolveRpId(hostname: string, configured = process.env.WEBAUTHN_RP_ID?.trim()): string {
  const host = String(hostname || "").toLowerCase();
  if (configured && (host === configured || host.endsWith(`.${configured}`))) return configured;
  if (host === "digeratiexperts.com" || host.endsWith(".digeratiexperts.com")) return "digeratiexperts.com";
  return host;
}

export function isAllowedOrigin(origin: string, rpId: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  const host = url.hostname.toLowerCase();
  const matchesRp = host === rpId || host.endsWith(`.${rpId}`);
  if (url.protocol === "https:") return matchesRp;
  // Browsers allow WebAuthn over plain http only on localhost.
  return url.protocol === "http:" && rpId === "localhost" && host === "localhost";
}

// ---------------------------------------------------------------------------
// Options

export function sameDeviceProvider(provider: PasskeyProviderId, userAgent: string): boolean {
  const ua = String(userAgent || "");
  if (provider === "apple") return /iPhone|iPad|Macintosh|Mac OS X/.test(ua) && !/Android/.test(ua);
  if (provider === "android") return /Android/.test(ua);
  return false;
}

export function buildRegistrationOptions(input: {
  rpId: string;
  user: { id: string; email: string; fullName?: string | null };
  provider: PasskeyProviderId;
  challenge: string;
  existing: StoredPasskey[];
  userAgent: string;
}) {
  const { provider } = input;
  const sameDevice = sameDeviceProvider(provider, input.userAgent);

  // Apple / Android on their own device: the built-in authenticator (Face ID, Touch ID,
  // fingerprint), saved to iCloud Keychain or Google Password Manager.
  // Apple / Android from another computer: scan a QR code with the phone (hybrid).
  // Microsoft Authenticator / JumpCloud: third-party passkey providers, picked from the
  // OS passkey sheet on the phone or offered through the QR flow, so the attachment is
  // left open.
  let authenticatorAttachment: "platform" | "cross-platform" | undefined;
  let hints: string[];
  if (provider === "apple" || provider === "android") {
    authenticatorAttachment = sameDevice ? "platform" : undefined;
    hints = sameDevice ? ["client-device"] : ["hybrid"];
  } else {
    hints = ["client-device", "hybrid"];
  }

  return {
    challenge: input.challenge,
    rp: { id: input.rpId, name: "Digerati Experts" },
    user: {
      id: b64url.encode(Buffer.from(input.user.id, "utf8")),
      name: input.user.email,
      displayName: input.user.fullName || input.user.email,
    },
    pubKeyCredParams: SUPPORTED_ALGORITHMS.map((alg) => ({ type: "public-key", alg })),
    timeout: 300_000,
    attestation: "none",
    authenticatorSelection: {
      ...(authenticatorAttachment ? { authenticatorAttachment } : {}),
      residentKey: "required",
      requireResidentKey: true,
      userVerification: "required",
    },
    excludeCredentials: input.existing
      .filter((p) => p.rpId === input.rpId)
      .map((p) => ({ type: "public-key", id: p.id, transports: p.transports })),
    hints,
    extensions: { credProps: true },
  };
}

export function buildAuthenticationOptions(input: { rpId: string; challenge: string; passkeys: StoredPasskey[] }) {
  return {
    challenge: input.challenge,
    rpId: input.rpId,
    timeout: 300_000,
    userVerification: "required",
    allowCredentials: input.passkeys
      .filter((p) => p.rpId === input.rpId)
      .map((p) => ({ type: "public-key", id: p.id, transports: p.transports })),
  };
}

// ---------------------------------------------------------------------------
// Minimal CBOR (RFC 8949) decoder: the subset WebAuthn uses.

type CborValue = number | bigint | string | boolean | null | undefined | Buffer | CborValue[] | Map<CborValue, CborValue>;

export function decodeCbor(buf: Buffer, start = 0): { value: CborValue; offset: number } {
  let offset = start;
  const need = (n: number) => {
    if (offset + n > buf.length) throw new Error("CBOR: truncated");
  };
  const readLength = (info: number): number => {
    if (info < 24) return info;
    if (info === 24) { need(1); return buf.readUInt8(offset++); }
    if (info === 25) { need(2); const v = buf.readUInt16BE(offset); offset += 2; return v; }
    if (info === 26) { need(4); const v = buf.readUInt32BE(offset); offset += 4; return v; }
    if (info === 27) {
      need(8);
      const v = buf.readBigUInt64BE(offset);
      offset += 8;
      if (v > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("CBOR: integer too large");
      return Number(v);
    }
    throw new Error("CBOR: indefinite lengths are not supported");
  };
  const item = (depth: number): CborValue => {
    if (depth > 16) throw new Error("CBOR: nested too deeply");
    need(1);
    const initial = buf.readUInt8(offset++);
    const major = initial >> 5;
    const info = initial & 31;
    switch (major) {
      case 0: return readLength(info);
      case 1: return -1 - readLength(info);
      case 2: { const n = readLength(info); need(n); const v = Buffer.from(buf.subarray(offset, offset + n)); offset += n; return v; }
      case 3: { const n = readLength(info); need(n); const v = buf.toString("utf8", offset, offset + n); offset += n; return v; }
      case 4: { const n = readLength(info); const arr: CborValue[] = []; for (let i = 0; i < n; i++) arr.push(item(depth + 1)); return arr; }
      case 5: {
        const n = readLength(info);
        const map = new Map<CborValue, CborValue>();
        for (let i = 0; i < n; i++) { const k = item(depth + 1); map.set(k, item(depth + 1)); }
        return map;
      }
      case 6: readLength(info); return item(depth + 1); // tag: keep the tagged value
      case 7:
        if (info === 20) return false;
        if (info === 21) return true;
        if (info === 22) return null;
        if (info === 23) return undefined;
        throw new Error("CBOR: unsupported simple value");
      default:
        throw new Error("CBOR: unsupported major type");
    }
  };
  const value = item(0);
  return { value, offset };
}

// ---------------------------------------------------------------------------
// Authenticator data

const FLAG_UP = 0x01;
const FLAG_UV = 0x04;
const FLAG_BE = 0x08;
const FLAG_BS = 0x10;
const FLAG_AT = 0x40;

type ParsedAuthData = {
  rpIdHash: Buffer;
  flags: number;
  signCount: number;
  aaguid?: string;
  credentialId?: Buffer;
  cosePublicKey?: Map<CborValue, CborValue>;
};

export function parseAuthenticatorData(data: Buffer): ParsedAuthData {
  if (data.length < 37) throw new Error("Authenticator data is too short");
  const rpIdHash = data.subarray(0, 32);
  const flags = data[32];
  const signCount = data.readUInt32BE(33);
  const parsed: ParsedAuthData = { rpIdHash, flags, signCount };
  if (flags & FLAG_AT) {
    if (data.length < 55) throw new Error("Attested credential data is truncated");
    const hex = data.subarray(37, 53).toString("hex");
    parsed.aaguid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    const idLength = data.readUInt16BE(53);
    if (idLength > 1023 || 55 + idLength > data.length) throw new Error("Credential id is malformed");
    parsed.credentialId = data.subarray(55, 55 + idLength);
    const { value } = decodeCbor(data, 55 + idLength);
    if (!(value instanceof Map)) throw new Error("Credential public key is not a COSE map");
    parsed.cosePublicKey = value;
  }
  return parsed;
}

function coseToSpki(cose: Map<CborValue, CborValue>): { spki: Buffer; algorithm: number } {
  const kty = cose.get(1);
  const alg = cose.get(3);
  if (typeof alg !== "number" || !SUPPORTED_ALGORITHMS.includes(alg)) throw new Error("Unsupported passkey algorithm");
  const bytes = (key: number) => {
    const v = cose.get(key);
    if (!Buffer.isBuffer(v)) throw new Error("COSE key is missing a field");
    return v.toString("base64url");
  };
  let jwk: Record<string, string>;
  if (kty === 2 && alg === -7 && cose.get(-1) === 1) jwk = { kty: "EC", crv: "P-256", x: bytes(-2), y: bytes(-3) };
  else if (kty === 1 && alg === -8 && cose.get(-1) === 6) jwk = { kty: "OKP", crv: "Ed25519", x: bytes(-2) };
  else if (kty === 3 && alg === -257) jwk = { kty: "RSA", n: bytes(-1), e: bytes(-2) };
  else throw new Error("COSE key type does not match its algorithm");
  const key = createPublicKey({ key: jwk as any, format: "jwk" });
  return { spki: key.export({ type: "spki", format: "der" }) as Buffer, algorithm: alg };
}

function sha256(data: Buffer | string): Buffer {
  return createHash("sha256").update(data).digest();
}

function sameString(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function checkClientData(raw: Buffer, type: string, expectedChallenge: string, rpId: string) {
  let clientData: any;
  try {
    clientData = JSON.parse(raw.toString("utf8"));
  } catch {
    throw new Error("clientDataJSON is not JSON");
  }
  if (clientData?.type !== type) throw new Error(`Unexpected ceremony type ${clientData?.type}`);
  if (typeof clientData.challenge !== "string" || !sameString(clientData.challenge, expectedChallenge)) {
    throw new Error("Challenge does not match");
  }
  if (!isAllowedOrigin(clientData.origin, rpId)) throw new Error(`Origin ${clientData.origin} is not allowed`);
  if (clientData.crossOrigin === true) throw new Error("Cross-origin ceremonies are not allowed");
}

function checkAuthData(auth: ParsedAuthData, rpId: string) {
  if (!auth.rpIdHash.equals(sha256(rpId))) throw new Error("RP ID does not match");
  if (!(auth.flags & FLAG_UP)) throw new Error("User presence was not confirmed");
  if (!(auth.flags & FLAG_UV)) throw new Error("User verification (Face ID, fingerprint or PIN) is required");
}

export function providerForAaguid(aaguid: string, chosen: PasskeyProviderId): { provider: PasskeyProviderId | "other"; label: string } {
  for (const [id, profile] of Object.entries(PASSKEY_PROVIDERS) as [PasskeyProviderId, ProviderProfile][]) {
    if (profile.aaguids.includes(aaguid)) return { provider: id, label: profile.store };
  }
  if (OTHER_AAGUIDS[aaguid]) return { provider: "other", label: OTHER_AAGUIDS[aaguid] };
  // Unknown or zeroed AAGUID (some providers and Safari send zeros): trust the user's pick for the label only.
  return { provider: chosen, label: PASSKEY_PROVIDERS[chosen].store };
}

// ---------------------------------------------------------------------------
// Ceremonies

export type RegistrationResponseJSON = {
  id: string;
  rawId: string;
  type: string;
  response: { clientDataJSON: string; attestationObject: string; transports?: string[] };
};

export function verifyRegistration(input: {
  credential: RegistrationResponseJSON;
  expectedChallenge: string;
  rpId: string;
  provider: PasskeyProviderId;
  nickname?: string;
  now?: Date;
}): StoredPasskey {
  const { credential, rpId } = input;
  if (!credential || credential.type !== "public-key" || !credential.response) throw new Error("Not a passkey credential");
  checkClientData(b64url.decode(credential.response.clientDataJSON), "webauthn.create", input.expectedChallenge, rpId);

  const { value: attestation } = decodeCbor(b64url.decode(credential.response.attestationObject));
  if (!(attestation instanceof Map)) throw new Error("attestationObject is not a CBOR map");
  const authDataBytes = attestation.get("authData");
  if (!Buffer.isBuffer(authDataBytes)) throw new Error("attestationObject has no authData");

  const auth = parseAuthenticatorData(authDataBytes);
  checkAuthData(auth, rpId);
  if (!auth.credentialId || !auth.cosePublicKey || !auth.aaguid) throw new Error("No credential was created");
  const credentialId = b64url.encode(auth.credentialId);
  if (credential.rawId !== credentialId || credential.id !== credentialId) throw new Error("Credential id mismatch");
  if (!(auth.flags & FLAG_BE) && auth.flags & FLAG_BS) throw new Error("Invalid backup flags");

  const { spki, algorithm } = coseToSpki(auth.cosePublicKey);
  const detected = auth.aaguid === ZERO_AAGUID
    ? { provider: input.provider, label: PASSKEY_PROVIDERS[input.provider].store }
    : providerForAaguid(auth.aaguid, input.provider);
  const allowedTransports = new Set(["ble", "cable", "hybrid", "internal", "nfc", "smart-card", "usb"]);
  const now = (input.now || new Date()).toISOString();

  return {
    id: credentialId,
    publicKey: b64url.encode(spki),
    algorithm,
    signCount: auth.signCount,
    transports: (credential.response.transports || []).filter((t) => allowedTransports.has(t)),
    aaguid: auth.aaguid,
    rpId,
    provider: detected.provider,
    providerLabel: detected.label,
    nickname: String(input.nickname || "").trim().slice(0, 60) || detected.label,
    backupEligible: !!(auth.flags & FLAG_BE),
    createdAt: now,
    lastUsedAt: null,
  };
}

export type AuthenticationResponseJSON = {
  id: string;
  rawId: string;
  type: string;
  response: { clientDataJSON: string; authenticatorData: string; signature: string; userHandle?: string | null };
};

/** Returns the passkey with its new signature counter and last-used time. Throws on any failure. */
export function verifyAuthentication(input: {
  credential: AuthenticationResponseJSON;
  expectedChallenge: string;
  rpId: string;
  passkeys: StoredPasskey[];
  userId: string;
  now?: Date;
}): StoredPasskey {
  const { credential, rpId } = input;
  if (!credential || credential.type !== "public-key" || !credential.response) throw new Error("Not a passkey credential");
  const stored = input.passkeys.find((p) => p.id === credential.rawId && p.rpId === rpId);
  if (!stored || credential.id !== credential.rawId) throw new Error("This passkey is not registered to the account");

  const clientDataRaw = b64url.decode(credential.response.clientDataJSON);
  checkClientData(clientDataRaw, "webauthn.get", input.expectedChallenge, rpId);

  const authDataBytes = b64url.decode(credential.response.authenticatorData);
  const auth = parseAuthenticatorData(authDataBytes);
  checkAuthData(auth, rpId);

  if (credential.response.userHandle) {
    const handle = b64url.decode(credential.response.userHandle).toString("utf8");
    if (handle !== input.userId) throw new Error("Passkey belongs to a different user");
  }

  const key = createPublicKey({ key: b64url.decode(stored.publicKey), format: "der", type: "spki" });
  const signed = Buffer.concat([authDataBytes, sha256(clientDataRaw)]);
  const signature = b64url.decode(credential.response.signature);
  const valid = stored.algorithm === -8
    ? cryptoVerify(null, signed, key, signature)
    : cryptoVerify("sha256", signed, key, signature);
  if (!valid) throw new Error("Passkey signature is invalid");

  // Synced passkeys (iCloud Keychain, Google Password Manager) always report 0.
  if ((auth.signCount > 0 || stored.signCount > 0) && auth.signCount <= stored.signCount) {
    throw new Error("Passkey signature counter went backwards; the authenticator may be cloned");
  }

  return {
    ...stored,
    signCount: auth.signCount,
    lastUsedAt: (input.now || new Date()).toISOString(),
  };
}

/** The fields safe to show the account owner. */
export function publicPasskeyView(p: StoredPasskey) {
  return {
    id: p.id,
    nickname: p.nickname,
    provider: p.provider,
    providerLabel: p.providerLabel,
    synced: p.backupEligible,
    createdAt: p.createdAt,
    lastUsedAt: p.lastUsedAt,
  };
}
