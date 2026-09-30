import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const card = readFileSync(resolve(here, "DeskLoginCard.tsx"), "utf8");
const storeAuth = readFileSync(resolve(here, "../hooks/useStoreAuth.ts"), "utf8");
const portalLogin = readFileSync(resolve(here, "../pages/portal/PortalLogin.tsx"), "utf8");
const portalApi = readFileSync(resolve(here, "../lib/portalApi.ts"), "utf8");
const serverRoutes = readFileSync(resolve(here, "../../../server/routes.ts"), "utf8");

describe("ASK DE shared portal authentication", () => {
  it("delegates password + MFA to canonical portal endpoints", () => {
    expect(card).toMatch(/fetch\("\/api\/portal\/login"/);
    expect(card).toMatch(/fetch\("\/api\/portal\/mfa\/verify-login"/);
    expect(card).toMatch(/credentials: "include"/);
    expect(card).not.toMatch(/\/api\/auth\//);
    expect(card).not.toMatch(/bcrypt|passkey|webauthn|navigator\.credentials/i);
  });

  it("uses the shared HttpOnly cookie as the browser session authority", () => {
    // ZohoASAPWidget.tsx stays on Claude freeze; assert the Cursor-owned shared-session surfaces.
    expect(storeAuth).toMatch(/fetch\("\/api\/portal\/me", \{[\s\S]*credentials: "include"/);
    expect(storeAuth).toMatch(/const isLoggedIn = useMemo\(\(\) => !!user/);
    expect(portalLogin).toMatch(/fetch\("\/api\/portal\/me", \{[\s\S]*credentials: "include"[\s\S]*cache: "no-store"/);
    expect(serverRoutes).toMatch(/const token = cookieToken \|\| bearer/);
    expect(portalApi).toMatch(/credentials: "include"/);
    expect(portalApi).not.toMatch(/localStorage\.getItem\("portalToken"\)/);
    expect(portalApi).toMatch(/de-portal-session-expired/);
  });

  it("keeps ASK DE stationary and provides a real back control", () => {
    // Widget wiring (onBack / remove portal-page upsell) is Claude-owned ZohoASAPWidget.
    // DeskLoginCard itself must still own dismiss + Zoho popup start.
    expect(card).toMatch(/button-desk-login-dismiss/);
    expect(card).toMatch(/window\.open\(/);
    expect(card).toMatch(/\/api\/portal\/auth\/zoho\/start/);
    expect(card).not.toMatch(/PORTAL_LOGIN/);
  });

  it("resets the single-use Turnstile token after failed password sign-in", () => {
    expect(card).toMatch(/turnstileKey/);
    expect(card).toMatch(/resetTurnstile\(\)/);
    expect(card).toMatch(/<TurnstileWidget key=\{turnstileKey\}/);
  });

  it("announces same-tab authentication changes for Store + ASK DE", () => {
    expect(card).toMatch(/new CustomEvent\("de-portal-auth-changed"\)/);
    expect(storeAuth).toMatch(/addEventListener\("de-portal-auth-changed"/);
    expect(storeAuth).toMatch(/addEventListener\("focus"/);
  });
});
