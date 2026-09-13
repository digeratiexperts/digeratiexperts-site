import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "ZohoASAPWidget.tsx"),
  "utf8",
);

describe("DE Desk shell positioning", () => {
  it("keeps the dialog position:fixed in unlayered CSS so Tailwind `fixed` cannot lose to `relative`", () => {
    const shell = src.match(/\.de-desk-shell \{[\s\S]*?box-shadow:[^}]+\}/);
    expect(shell?.[0]).toMatch(/position:\s*fixed/);
    expect(shell?.[0]).not.toMatch(/position:\s*relative/);
  });

  it("stops pointer events on the shell so inner clicks cannot count as outside/dismiss", () => {
    expect(src).toMatch(/data-testid="desk-modal"/);
    expect(src).toMatch(/onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/);
    expect(src).toMatch(/onClick=\{\(event\) => event\.stopPropagation\(\)\}/);
  });

  it("ignores a close click that arrives with the same pointer that opened the Desk", () => {
    expect(src).toMatch(/ignoreDismissUntilRef/);
    expect(src).toMatch(/Date\.now\(\) \+ 400/);
  });

  it("keeps graphite chrome with a magenta cap instead of purple-wash or cream fields", () => {
    expect(src).toMatch(/inset 0 1px 0 #D3126A/);
    expect(src).toMatch(/\.de-desk-shell::before \{\s*content:\s*none;/);
    expect(src).toMatch(/background-color: var\(--de-raised, #151217\) !important;/);
    expect(src).toMatch(/background-clip: padding-box, border-box;/);
    expect(src).not.toMatch(/radial-gradient\(ellipse 70% 36% at 50% 0%, rgba\(91,69,224/);
    expect(src).not.toMatch(/background:\s*#fcfaf7/);
    expect(src).toMatch(/PORTAL_LOGIN/);
    expect(src).toMatch(/from "@\/lib\/portalUrls"/);
    expect(src).toMatch(/href=\{PORTAL_LOGIN\}/);
    expect(src).not.toMatch(/\/\/login/);
    expect(src).toMatch(/Sign in to Client Tools/);
    expect(src).not.toMatch(/My Devices|Software Library|System Health Check/);
    expect(src).not.toMatch(/href: "\/portal\/status"/);
  });

  it("keeps Get Support optional fields behind a distinct control, not a second Details label", () => {
    expect(src).toMatch(/Add company or category/);
    expect(src).not.toMatch(/>More details</);
    expect(src).toMatch(/Possible security incident/);
    expect(src).toMatch(/What do you need help with\?/);
  });

  it("uses underline tabs and honest available copy without SOC chrome", () => {
    expect(src).toMatch(/role="tablist"/);
    expect(src).toMatch(/role="tab"/);
    expect(src).toMatch(/aria-selected=\{isActive\}/);
    expect(src).not.toMatch(/aria-current=\{isActive \? "page"/);
    expect(src).toMatch(/DE Desk is available/);
    expect(src).not.toMatch(/AZ SOC Live/);
    expect(src).toMatch(/\.de-desk-tab\.is-active::after/);
    expect(src).not.toMatch(/\.de-desk-tab\.is-active \{\s*background: #D3126A;/);
    expect(src).toMatch(/previous\?\.focus/);
    expect(src).toMatch(/useEscapeKey/);
  });

  it("keeps Arizona perk copy in Get Support and does not add extra Tools phone chrome", () => {
    expect(src).toMatch(/100% Arizona-based engineering desk/);
    expect(src).toMatch(/Direct portal tracking &amp; phone escalation/);
    expect(src).not.toMatch(/Direct Desk:/);
    expect(src).not.toMatch(/resource-link-phone-support/);
    expect(src).not.toMatch(/className="de-desk-foot"/);
    expect(src).toMatch(/href=\{PRIMARY_PHONE\.telHref\}/);
    expect(src).toMatch(/href=\{PORTAL_LOGIN\}/);
    expect(src).not.toMatch(/\/\/login/);
  });

  it("does not fake a widget file upload", () => {
    expect(src).not.toMatch(/input-support-attachment/);
    expect(src).not.toMatch(/type="file"/);
    expect(src).toMatch(/aria-invalid=\{ticketFieldErrors/);
    expect(src).toMatch(/support-submit-error/);
  });

  it("gives Get Support fields a brighter interactive white outline and magenta focus", () => {
    expect(src).toMatch(/trackDeskSupportFieldSpotlight/);
    expect(src).toMatch(/onPointerMove=\{trackDeskSupportFieldSpotlight\}/);
    expect(src).toMatch(/linear-gradient\(rgba\(255,255,255,0\.88\), rgba\(255,255,255,0\.88\)\)/);
    expect(src).toMatch(/radial-gradient\([\s\S]*--desk-spot-x/);
    expect(src).toMatch(/linear-gradient\(#D3126A, #D3126A\)/);
    expect(src).toMatch(/0 0 0 1px rgba\(255,255,255,0\.5\)/);
  });

  it("paints Get Support issue choices white with black type and a slow hover wash", () => {
    expect(src).toMatch(/trackDeskSupportRowGlow/);
    expect(src).toMatch(/\.de-desk-issue-list \{[\s\S]*?background: #fff;/);
    expect(src).toMatch(/\.de-desk-issue-row \{[\s\S]*?color: #17141f;/);
    expect(src).toMatch(/\.de-desk-incident \{[\s\S]*?background: #fff;/);
    expect(src).toMatch(/\.de-desk-incident-copy strong \{[\s\S]*?color: #17141f;/);
  });

  it("opens a tad wider with one-step larger type on chrome, Client Tools, and Ask DE", () => {
    expect(src).toMatch(/sm:w-\[440px\]/);
    expect(src).not.toMatch(/sm:w-\[410px\]/);
    expect(src).toMatch(/\.de-desk-id h2 \{[\s\S]*?font-size: 17px;/);
    expect(src).toMatch(/\.de-desk-id p \{ font-size: 14px;/);
    expect(src).toMatch(/\.de-desk-tab \{[\s\S]*?font-size: 14\.5px;/);
    expect(src).toMatch(/\.de-desk-tools-intro h3 \{[\s\S]*?font-size: 18px;/);
    expect(src).toMatch(/\.de-desk-tools-kicker \{[\s\S]*?font-size: 16px !important;/);
    expect(src).toMatch(/\.de-desk-tools-intro p \{[\s\S]*?font-size: 14\.5px;/);
    expect(src).toMatch(/\.de-desk-bubble \{[\s\S]*?font-size: 15px;/);
    expect(src).toMatch(/\.de-desk-composer input \{[\s\S]*?font-size: 15\.5px;/);
    expect(src).toMatch(/\.de-desk-composer-caption \{[\s\S]*?font-size: 13px;/);
    expect(src).toMatch(/\.de-desk-tool-title \{[\s\S]*?font-size: 15\.5px;/);
  });

  it("stamps Ask DE messages with a real local time, not fake SOC chrome", () => {
    expect(src).toMatch(/function formatDeskMessageTime/);
    expect(src).toMatch(/className="de-desk-msg-time"/);
    expect(src).toMatch(/dateTime=\{chatMessage\.createdAt\}/);
    expect(src).toMatch(/toLocaleTimeString\(undefined, \{ hour: "numeric", minute: "2-digit" \}\)/);
    expect(src).not.toMatch(/AZ SOC Live/);
  });

  it("styles Ask DE discovery and Get Support issues as graphite grouped stacks", () => {
    expect(src).toMatch(/de-desk-discover/);
    expect(src).toMatch(/de-desk-discover-list/);
    expect(src).toMatch(/ask-de-starter-chips/);
    expect(src).toMatch(/Suggested questions/);
    expect(src).toMatch(/startersForPage/);
    expect(src).toMatch(/de-desk-ticket-upper/);
    expect(src).toMatch(/de-desk-perk-list/);
    expect(src).toMatch(/\.de-desk-issue-list \{[\s\S]*?border-radius: 15px;/);
    expect(src).not.toMatch(/linear-gradient\(135deg, rgba\(211,18,106,0\.16\)/);
    expect(src).toMatch(/background: #fff;/);
    expect(src).toMatch(/Sign in to Client Tools/);
    expect(src).toMatch(/Create ticket/);
    expect(src).toMatch(/de-desk-btn-grad/);
    expect(src).toMatch(/de-desk-urgency/);
    expect(src).toMatch(/\.de-desk-scroll > \* \{ flex-shrink: 0; \}/);
  });

  it("keeps Ask DE motion as presentation-only over canonical message content", () => {
    expect(src).toMatch(/from "@\/lib\/deskAskDeMotion"/);
    expect(src).toMatch(/typewriteText\(/);
    expect(src).toMatch(/streamWords\(/);
    expect(src).toMatch(/greetingVisible/);
    expect(src).toMatch(/setReveal\(/);
    expect(src).toMatch(/className="sr-only"/);
    expect(src).toMatch(/de-desk-typing/);
    expect(src).not.toMatch(/Thinking it through/);
    expect(src).toMatch(/aria-live="polite"/);
    expect(src).toMatch(/prefersReducedMotion/);
  });
});
