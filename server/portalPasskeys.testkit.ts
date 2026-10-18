/**
 * Test-only software authenticator: just enough CBOR and authenticator data to
 * drive the WebAuthn verifier in portalPasskeys.ts. Shared by the unit tests
 * and the enrollment route tests. Not imported by production code.
 */
import { createHash, generateKeyPairSync, randomBytes, sign, type KeyObject } from "crypto";

export function cborHead(major: number, n: number): Buffer {
  if (n < 24) return Buffer.from([(major << 5) | n]);
  if (n < 256) return Buffer.from([(major << 5) | 24, n]);
  if (n < 65536) { const b = Buffer.alloc(3); b[0] = (major << 5) | 25; b.writeUInt16BE(n, 1); return b; }
  const b = Buffer.alloc(5); b[0] = (major << 5) | 26; b.writeUInt32BE(n, 1); return b;
}
export function cbor(value: unknown): Buffer {
  if (typeof value === "number") return value >= 0 ? cborHead(0, value) : cborHead(1, -1 - value);
  if (Buffer.isBuffer(value)) return Buffer.concat([cborHead(2, value.length), value]);
  if (typeof value === "string") { const b = Buffer.from(value, "utf8"); return Buffer.concat([cborHead(3, b.length), b]); }
  if (value instanceof Map) {
    const parts = [cborHead(5, value.size)];
    for (const [k, v] of value) parts.push(cbor(k), cbor(v));
    return Buffer.concat(parts);
  }
  throw new Error("test cbor: unsupported");
}

export const RP_ID = "digeratiexperts.com";
export const ORIGIN = "https://portal.digeratiexperts.com";
export const USER_ID = "user-123";
export const AAGUID = {
  apple: "fbfc3007-154e-4ecc-8c0b-6e020557d7bd",
  android: "ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4",
  microsoft: "90a3ccdf-635c-4729-a248-9b709135078f",
  zero: "00000000-0000-0000-0000-000000000000",
};

export type Alg = "es256" | "eddsa" | "rs256";

export function makeAuthenticator(alg: Alg = "es256", aaguid = AAGUID.apple, flags = 0x01 | 0x04 | 0x08 | 0x10) {
  let privateKey: KeyObject;
  let cose: Map<number, unknown>;
  if (alg === "es256") {
    const pair = generateKeyPairSync("ec", { namedCurve: "P-256" });
    privateKey = pair.privateKey;
    const jwk = pair.publicKey.export({ format: "jwk" }) as any;
    cose = new Map<number, unknown>([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x, "base64url")], [-3, Buffer.from(jwk.y, "base64url")]]);
  } else if (alg === "eddsa") {
    const pair = generateKeyPairSync("ed25519");
    privateKey = pair.privateKey;
    const jwk = pair.publicKey.export({ format: "jwk" }) as any;
    cose = new Map<number, unknown>([[1, 1], [3, -8], [-1, 6], [-2, Buffer.from(jwk.x, "base64url")]]);
  } else {
    const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
    privateKey = pair.privateKey;
    const jwk = pair.publicKey.export({ format: "jwk" }) as any;
    cose = new Map<number, unknown>([[1, 3], [3, -257], [-1, Buffer.from(jwk.n, "base64url")], [-2, Buffer.from(jwk.e, "base64url")]]);
  }
  const credentialId = randomBytes(16);
  let counter = 0;

  const authData = (rpId: string, withCredential: boolean, extraFlags = 0, signCount = counter) => {
    const head = Buffer.alloc(37);
    createHash("sha256").update(rpId).digest().copy(head, 0);
    head[32] = flags | extraFlags | (withCredential ? 0x40 : 0);
    head.writeUInt32BE(signCount, 33);
    if (!withCredential) return head;
    const idLen = Buffer.alloc(2);
    idLen.writeUInt16BE(credentialId.length);
    return Buffer.concat([head, Buffer.from(aaguid.replace(/-/g, ""), "hex"), idLen, credentialId, cbor(cose)]);
  };

  return {
    id: credentialId.toString("base64url"),
    setCounter: (n: number) => { counter = n; },
    register(challenge: string, opts: { origin?: string; rpId?: string; type?: string } = {}) {
      const clientDataJSON = Buffer.from(JSON.stringify({ type: opts.type || "webauthn.create", challenge, origin: opts.origin || ORIGIN }));
      const attestationObject = cbor(new Map<string, unknown>([["fmt", "none"], ["attStmt", new Map()], ["authData", authData(opts.rpId || RP_ID, true)]]));
      return {
        id: credentialId.toString("base64url"),
        rawId: credentialId.toString("base64url"),
        type: "public-key",
        response: {
          clientDataJSON: clientDataJSON.toString("base64url"),
          attestationObject: attestationObject.toString("base64url"),
          transports: ["internal", "hybrid", "bogus"],
        },
      };
    },
    assert(challenge: string, opts: { origin?: string; userHandle?: string | null; tamper?: boolean } = {}) {
      const clientDataJSON = Buffer.from(JSON.stringify({ type: "webauthn.get", challenge, origin: opts.origin || ORIGIN }));
      const data = authData(RP_ID, false);
      const signed = Buffer.concat([data, createHash("sha256").update(clientDataJSON).digest()]);
      const signature = sign(alg === "eddsa" ? null : "sha256", signed, privateKey);
      if (opts.tamper) signature[signature.length - 1] ^= 0xff;
      return {
        id: credentialId.toString("base64url"),
        rawId: credentialId.toString("base64url"),
        type: "public-key",
        response: {
          clientDataJSON: clientDataJSON.toString("base64url"),
          authenticatorData: data.toString("base64url"),
          signature: signature.toString("base64url"),
          userHandle: opts.userHandle === undefined ? Buffer.from(USER_ID).toString("base64url") : opts.userHandle,
        },
      };
    },
  };
}
