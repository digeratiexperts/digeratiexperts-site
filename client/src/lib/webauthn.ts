/**
 * Browser half of portal passkeys. Turns the server's JSON options into the
 * ArrayBuffers navigator.credentials wants, and the credential back into JSON.
 * Uses the WebAuthn Level 3 JSON helpers where the browser has them.
 */

export type PasskeyProvider = "apple" | "android" | "microsoft" | "jumpcloud";

function toBuffer(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function toBase64url(buffer: ArrayBuffer | null | undefined): string {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function passkeysSupported(): boolean {
  return typeof window !== "undefined" && !!window.PublicKeyCredential && !!navigator.credentials;
}

/** Best guess at the user's own platform, to put that provider first. */
export function detectPlatform(): PasskeyProvider | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  if (/Android/.test(ua)) return "android";
  if (/iPhone|iPad|Macintosh/.test(ua)) return "apple";
  return null;
}

export async function createPasskey(options: any): Promise<Record<string, unknown>> {
  const PKC = window.PublicKeyCredential as any;
  const publicKey: PublicKeyCredentialCreationOptions =
    typeof PKC?.parseCreationOptionsFromJSON === "function"
      ? PKC.parseCreationOptionsFromJSON(options)
      : {
          ...options,
          challenge: toBuffer(options.challenge),
          user: { ...options.user, id: toBuffer(options.user.id) },
          excludeCredentials: (options.excludeCredentials || []).map((c: any) => ({ ...c, id: toBuffer(c.id) })),
        };
  const credential = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null;
  if (!credential) throw new Error("No passkey was created");
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: toBase64url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: (credential as any).authenticatorAttachment ?? null,
    response: {
      clientDataJSON: toBase64url(response.clientDataJSON),
      attestationObject: toBase64url(response.attestationObject),
      transports: typeof response.getTransports === "function" ? response.getTransports() : [],
    },
  };
}

export async function getPasskey(options: any): Promise<Record<string, unknown>> {
  const PKC = window.PublicKeyCredential as any;
  const publicKey: PublicKeyCredentialRequestOptions =
    typeof PKC?.parseRequestOptionsFromJSON === "function"
      ? PKC.parseRequestOptionsFromJSON(options)
      : {
          ...options,
          challenge: toBuffer(options.challenge),
          allowCredentials: (options.allowCredentials || []).map((c: any) => ({ ...c, id: toBuffer(c.id) })),
        };
  const credential = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;
  if (!credential) throw new Error("No passkey was used");
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: toBase64url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: toBase64url(response.clientDataJSON),
      authenticatorData: toBase64url(response.authenticatorData),
      signature: toBase64url(response.signature),
      userHandle: response.userHandle ? toBase64url(response.userHandle) : null,
    },
  };
}

/** Plain-language reason for a failed passkey prompt. */
export function passkeyErrorMessage(err: any): string {
  switch (err?.name) {
    case "NotAllowedError":
      return "The passkey prompt was closed or timed out. Try again when you're ready.";
    case "InvalidStateError":
      return "This device already has a passkey for your account.";
    case "SecurityError":
      return "Passkeys only work on the secure portal address (https://portal.digeratiexperts.com).";
    case "NotSupportedError":
      return "This browser or device can't create that kind of passkey.";
    default:
      return err?.message || "Passkey request failed";
  }
}
