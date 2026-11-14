export type PortalMfaMethod = "totp" | "email";

export type PortalSsoMfaHandoff = {
  mfaToken: string;
  mfaMethod: PortalMfaMethod;
  message: string;
};

export function safePortalReturnTo(raw: unknown): string {
  if (typeof raw !== "string" || raw.startsWith("//")) {
    return "/portal/dashboard";
  }
  return raw.startsWith("/portal") || raw.startsWith("/store")
    ? raw
    : "/portal/dashboard";
}

export function readPortalSsoMfaHandoff(
  search: string,
  hash: string,
): PortalSsoMfaHandoff | null {
  const query = new URLSearchParams(search);
  if (query.get("mfa") !== "required") return null;

  const fragment = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const mfaToken = fragment.get("mfaToken") || "";
  const mfaMethod = fragment.get("mfaMethod");
  if (!/^[a-f0-9]{32}$/i.test(mfaToken)) return null;
  if (mfaMethod !== "totp" && mfaMethod !== "email") return null;

  return {
    mfaToken,
    mfaMethod,
    message: mfaMethod === "email"
      ? "A verification code has been sent to your email."
      : "Enter the code from your authenticator app.",
  };
}

export function portalLoginUrlAfterMfaHydration(pathname: string, search: string): string {
  const query = new URLSearchParams(search);
  query.delete("mfa");
  const remaining = query.toString();
  return `${pathname}${remaining ? `?${remaining}` : ""}`;
}
