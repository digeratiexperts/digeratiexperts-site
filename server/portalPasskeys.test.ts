import { createHash, generateKeyPairSync, randomBytes, sign, type KeyObject } from "crypto";
import { describe, expect, it } from "vitest";
import {
  buildAuthenticationOptions,
  buildRegistrationOptions,
  decodeCbor,
  isAllowedOrigin,
  newChallenge,
  resolveRpId,
  verifyAuthentication,
  verifyRegistration,
  type PasskeyProviderId,
  type StoredPasskey,
} from "./portalPasskeys";

// --- A software authenticator: just enough CBOR and authenticator data to drive the verifier.

function cborHead(major: number, n: number): Buffer {
  if (n < 24) return Buffer.from([(major << 5) | n]);
  if (n < 256) return Buffer.from([(major << 5) | 24, n]);
  if (n < 65536) { const b = Buffer.alloc(3); b[0] = (major << 5) | 25; b.writeUInt16BE(n, 1); return b; }
  const b = Buffer.alloc(5); b[0] = (major << 5) | 26; b.writeUInt32BE(n, 1); return b;
}
function cbor(value: unknown): Buffer {
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

const RP_ID = "digeratiexperts.com";
const ORIGIN = "https://portal.digeratiexperts.com";
const USER_ID = "user-123";
const AAGUID = {
  apple: "fbfc3007-154e-4ecc-8c0b-6e020557d7bd",
  android: "ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4",
  microsoft: "90a3ccdf-635c-4729-a248-9b709135078f",
  zero: "00000000-0000-0000-0000-000000000000",
};

type Alg = "es256" | "eddsa" | "rs256";

function makeAuthenticator(alg: Alg = "es256", aaguid = AAGUID.apple, flags = 0x01 | 0x04 | 0x08 | 0x10) {
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

function register(alg: Alg = "es256", aaguid = AAGUID.apple, provider: PasskeyProviderId = "apple") {
  const authenticator = makeAuthenticator(alg, aaguid);
  const challenge = newChallenge();
  const passkey = verifyRegistration({ credential: authenticator.register(challenge), expectedChallenge: challenge, rpId: RP_ID, provider });
  return { authenticator, passkey };
}

describe("relying party", () => {
  it("uses the registrable domain so one passkey covers the site and the portal", () => {
    expect(resolveRpId("portal.digeratiexperts.com", "")).toBe("digeratiexperts.com");
    expect(resolveRpId("digeratiexperts.com", "")).toBe("digeratiexperts.com");
    expect(resolveRpId("localhost", "")).toBe("localhost");
    expect(resolveRpId("staging.example.org", "example.org")).toBe("example.org");
  });

  it("allows https origins on the RP domain and http only on localhost", () => {
    expect(isAllowedOrigin("https://portal.digeratiexperts.com", RP_ID)).toBe(true);
    expect(isAllowedOrigin("https://digeratiexperts.com", RP_ID)).toBe(true);
    expect(isAllowedOrigin("http://portal.digeratiexperts.com", RP_ID)).toBe(false);
    expect(isAllowedOrigin("https://digeratiexperts.com.evil.io", RP_ID)).toBe(false);
    expect(isAllowedOrigin("https://evildigeratiexperts.com", RP_ID)).toBe(false);
    expect(isAllowedOrigin("http://localhost:5000", "localhost")).toBe(true);
    expect(isAllowedOrigin("not a url", RP_ID)).toBe(false);
  });
});

describe("provider-specific registration options", () => {
  const user = { id: USER_ID, email: "joe@example.com", fullName: "Joe" };
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15";
  const pixel = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130 Mobile";
  const windows = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130";
  const build = (provider: PasskeyProviderId, userAgent: string) =>
    buildRegistrationOptions({ rpId: RP_ID, user, provider, challenge: "c", existing: [], userAgent });

  it("Apple on an Apple device: built-in Face ID / Touch ID", () => {
    const o = build("apple", iphone);
    expect(o.authenticatorSelection).toMatchObject({ authenticatorAttachment: "platform", residentKey: "required", userVerification: "required" });
    expect(o.hints).toEqual(["client-device"]);
  });

  it("Apple from a Windows PC: the iPhone over the QR (hybrid) flow", () => {
    const o = build("apple", windows);
    expect(o.authenticatorSelection).not.toHaveProperty("authenticatorAttachment");
    expect(o.hints).toEqual(["hybrid"]);
  });

  it("Android on an Android phone: Google Password Manager on the device", () => {
    const o = build("android", pixel);
    expect(o.authenticatorSelection).toMatchObject({ authenticatorAttachment: "platform" });
    expect(o.hints).toEqual(["client-device"]);
  });

  it("Microsoft Authenticator and JumpCloud leave the provider choice to the OS sheet", () => {
    for (const provider of ["microsoft", "jumpcloud"] as const) {
      const o = build(provider, iphone);
      expect(o.authenticatorSelection).not.toHaveProperty("authenticatorAttachment");
      expect(o.hints).toEqual(["client-device", "hybrid"]);
    }
  });

  it("asks for no attestation, ES256/EdDSA/RS256, and excludes already-registered passkeys", () => {
    const { passkey } = register();
    const o = buildRegistrationOptions({ rpId: RP_ID, user, provider: "apple", challenge: "c", existing: [passkey], userAgent: iphone });
    expect(o.attestation).toBe("none");
    expect(o.pubKeyCredParams.map((p) => p.alg)).toEqual([-7, -8, -257]);
    expect(o.excludeCredentials).toEqual([{ type: "public-key", id: passkey.id, transports: passkey.transports }]);
    expect(Buffer.from(o.user.id, "base64url").toString()).toBe(USER_ID);
  });
});

describe("registration", () => {
  it("verifies an Apple iCloud Keychain passkey and labels it from the AAGUID", () => {
    const { passkey } = register("es256", AAGUID.apple, "apple");
    expect(passkey).toMatchObject({ provider: "apple", providerLabel: "iCloud Keychain (Passwords app)", algorithm: -7, rpId: RP_ID, backupEligible: true });
    expect(passkey.transports).toEqual(["internal", "hybrid"]);
  });

  it("recognises Google Password Manager and Microsoft Authenticator from their AAGUIDs", () => {
    expect(register("es256", AAGUID.android, "android").passkey.providerLabel).toBe("Google Password Manager");
    expect(register("es256", AAGUID.microsoft, "apple").passkey.provider).toBe("microsoft");
  });

  it("falls back to the picked provider when the AAGUID is zeroed (JumpCloud, privacy-mode browsers)", () => {
    expect(register("es256", AAGUID.zero, "jumpcloud").passkey).toMatchObject({ provider: "jumpcloud", providerLabel: "JumpCloud Password Manager" });
  });

  it("supports EdDSA and RS256 keys", () => {
    expect(register("eddsa").passkey.algorithm).toBe(-8);
    expect(register("rs256").passkey.algorithm).toBe(-257);
  });

  it("rejects a wrong challenge, origin, ceremony type or RP ID", () => {
    const a = makeAuthenticator();
    const challenge = newChallenge();
    const attempt = (credential: any, expected = challenge) =>
      () => verifyRegistration({ credential, expectedChallenge: expected, rpId: RP_ID, provider: "apple" });
    expect(attempt(a.register(challenge), newChallenge())).toThrow(/Challenge/);
    expect(attempt(a.register(challenge, { origin: "https://evil.example" }))).toThrow(/Origin/);
    expect(attempt(a.register(challenge, { type: "webauthn.get" }))).toThrow(/ceremony/);
    expect(attempt(a.register(challenge, { rpId: "evil.example" }))).toThrow(/RP ID/);
  });

  it("requires user verification", () => {
    const a = makeAuthenticator("es256", AAGUID.apple, 0x01);
    const challenge = newChallenge();
    expect(() => verifyRegistration({ credential: a.register(challenge), expectedChallenge: challenge, rpId: RP_ID, provider: "apple" })).toThrow(/verification/);
  });
});

describe("sign-in", () => {
  it("verifies an assertion and records last use", () => {
    for (const alg of ["es256", "eddsa", "rs256"] as const) {
      const { authenticator, passkey } = register(alg);
      const challenge = newChallenge();
      const updated = verifyAuthentication({
        credential: authenticator.assert(challenge),
        expectedChallenge: challenge,
        rpId: RP_ID,
        passkeys: [passkey],
        userId: USER_ID,
      });
      expect(updated.id).toBe(passkey.id);
      expect(updated.lastUsedAt).not.toBeNull();
    }
  });

  it("rejects a bad signature, a replayed challenge, another user's handle and unknown passkeys", () => {
    const { authenticator, passkey } = register();
    const challenge = newChallenge();
    const run = (credential: any, opts: { expected?: string; passkeys?: StoredPasskey[] } = {}) => () =>
      verifyAuthentication({ credential, expectedChallenge: opts.expected ?? challenge, rpId: RP_ID, passkeys: opts.passkeys ?? [passkey], userId: USER_ID });
    expect(run(authenticator.assert(challenge, { tamper: true }))).toThrow(/signature/);
    expect(run(authenticator.assert(challenge), { expected: newChallenge() })).toThrow(/Challenge/);
    expect(run(authenticator.assert(challenge, { userHandle: Buffer.from("someone-else").toString("base64url") }))).toThrow(/different user/);
    expect(run(authenticator.assert(challenge), { passkeys: [] })).toThrow(/not registered/);
    expect(run(authenticator.assert(challenge, { origin: "https://phish.example" }))).toThrow(/Origin/);
  });

  it("accepts a missing user handle (non-discoverable flow)", () => {
    const { authenticator, passkey } = register();
    const challenge = newChallenge();
    expect(() => verifyAuthentication({ credential: authenticator.assert(challenge, { userHandle: null }), expectedChallenge: challenge, rpId: RP_ID, passkeys: [passkey], userId: USER_ID })).not.toThrow();
  });

  it("rejects a signature counter that goes backwards (cloned authenticator)", () => {
    const { authenticator, passkey } = register();
    authenticator.setCounter(5);
    const c1 = newChallenge();
    const after = verifyAuthentication({ credential: authenticator.assert(c1), expectedChallenge: c1, rpId: RP_ID, passkeys: [passkey], userId: USER_ID });
    expect(after.signCount).toBe(5);
    const c2 = newChallenge();
    expect(() => verifyAuthentication({ credential: authenticator.assert(c2), expectedChallenge: c2, rpId: RP_ID, passkeys: [after], userId: USER_ID })).toThrow(/counter/);
  });

  it("only offers passkeys registered for this RP ID", () => {
    const { passkey } = register();
    const other = { ...passkey, id: "other", rpId: "localhost" };
    const o = buildAuthenticationOptions({ rpId: RP_ID, challenge: "c", passkeys: [passkey, other] });
    expect(o.allowCredentials.map((c) => c.id)).toEqual([passkey.id]);
    expect(o.userVerification).toBe("required");
  });
});

describe("CBOR decoder", () => {
  it("rejects truncated input and indefinite lengths", () => {
    expect(() => decodeCbor(Buffer.from([0x59, 0x00]))).toThrow(/truncated/);
    expect(() => decodeCbor(Buffer.from([0x5f]))).toThrow(/indefinite/);
  });
});
