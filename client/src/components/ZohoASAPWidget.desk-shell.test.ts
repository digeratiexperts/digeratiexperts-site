import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "ZohoASAPWidget.tsx"),
  "utf8",
);
const bottomBarSrc = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "SiteBottomBar.tsx"),
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

  it("keeps the black panel with a gold cap instead of a glow, a purple wash or cream fields", () => {
    expect(src).toMatch(/inset 0 1px 0 #E3B23C/);
    expect(src).toMatch(/\.de-desk-shell::before \{\s*content:\s*none;/);
    expect(src).toMatch(/background-color: var\(--desk-box\) !important;/);
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
    expect(src).not.toMatch(/\.de-desk-tab\.is-active \{\s*background: #E3B23C;/);
    expect(src).toMatch(/previous\?\.focus/);
    expect(src).toMatch(/useEscapeKey/);
    // With nobody in the chat, the composer claims no one is waiting, and the
    // line fits a 390px field (the old one cut to "we're ready no").
    expect(src).toMatch(/: "Type the issue…"/);
    expect(src).not.toMatch(/we're ready now/);
  });

  it("draws both grouped lists with the same hairline", () => {
    // Get Support's issue list and Client Tools' list are one kind of object and
    // are drawn the same: one --desk-border-strong hairline, no bright inset rim.
    expect(src).not.toMatch(/0 1px 0 rgba\(255,\s*255,\s*255,\s*0\.[3-9]\d*\) inset/);
    expect(src).toMatch(/\.de-desk-issue-list \{[\s\S]*?border: 1px solid var\(--desk-border-strong\);/);
    expect(src).toMatch(/\.de-desk-tools-list \{[\s\S]*?border: 1px solid var\(--desk-border-strong\);/);
  });

  it("keeps exactly one theme: no second token declaration, no external override, one accent", () => {
    // The Desk used to carry two themes at once - a paper set re-declared inside
    // .de-desk-tools-list, dragged back to graphite by an !important file in
    // another module. Both are gone; a Desk colour is wrong in one place only.
    expect(src).not.toMatch(/\.de-desk-tools-list \{[^}]*--desk-ink:/);
    expect(src).not.toMatch(/--desk-shell-/);
    // Joe, 2026-10-01: gold is the Desk's one accent. No magenta anywhere in
    // the widget, as a literal, an alpha, a token or a Tailwind class.
    expect(src).not.toMatch(/#d3126a|rgba\(211,\s*18,\s*106|--desk-pink|de-magenta/i);
    expect(src).not.toMatch(/#e3b23c/); // one casing for the Desk gold
  });

  it("keeps Get Support free of marketing perks and extra Tools phone chrome", () => {
    // The perk bullets were marketing inside a support tool, and the "100%"
    // claim was not sourced anywhere. Get Support states the function and the
    // routing, nothing else.
    expect(src).not.toMatch(/100% Arizona-based engineering desk/);
    expect(src).not.toMatch(/de-desk-perk-list/);
    expect(src).toMatch(/route your request straight to the Arizona desk/);
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

  it("gives Get Support fields a white hairline outline on charcoal and gold focus", () => {
    expect(src).toMatch(/trackDeskSupportFieldSpotlight/);
    expect(src).toMatch(/onPointerMove=\{trackDeskSupportFieldSpotlight\}/);
    expect(src).toMatch(/linear-gradient\(rgba\(255,255,255,0\.16\), rgba\(255,255,255,0\.16\)\)/);
    expect(src).toMatch(/radial-gradient\([\s\S]*--desk-spot-x/);
    expect(src).toMatch(/linear-gradient\(#E3B23C, #E3B23C\)/);
    expect(src).toMatch(/0 0 0 1px rgba\(255,255,255,0\.06\)/);
  });

  it("paints Get Support issue choices on the one Desk token set", () => {
    expect(src).toMatch(/trackDeskSupportRowGlow/);
    expect(src).toMatch(/\.de-desk-issue-list \{[\s\S]*?background: var\(--desk-box\);/);
    // The incident rail is a gold wash over the same row ground, not a ground of its own.
    expect(src).toMatch(/\.de-desk-incident \{[\s\S]*?background: color-mix\(in srgb, #E3B23C 9%, var\(--desk-box\)\);/);
    const incidentRule = src.match(/\.de-desk-incident \{[^}]*\}/)?.[0] ?? "";
    expect(incidentRule).not.toMatch(/inset 3px 0 0/);
    // The whole Desk resolves through one token set; these literals belonged to
    // the retired override files and must not come back as raw values.
    expect(src).not.toMatch(/#17141f/);
    expect(src).not.toMatch(/#f7f5f2/);
  });

  it("is the black + grey + gold panel Joe picked on 2026-10-01, not the white panel", () => {
    // Joe, 2026-10-01: of eight Desk mockups, "Black + Grey + Yellow", built
    // with the mark's Signal Gold (brand/README.md) and without the glowing
    // halo. A near-black panel, charcoal rows, white/10 hairlines, white ink,
    // gold only for the cap, the active tab, actions and the incident rail.
    const tokens = src.match(/\.de-desk-shell \{[\s\S]*?--desk-green:[^;]+;/)?.[0] ?? "";
    expect(tokens).toMatch(/--desk-surface: #0b0b0d;/);
    expect(tokens).toMatch(/--desk-box: #19191c;/);
    expect(tokens).toMatch(/--desk-border: rgba\(255,255,255,0\.10\);/);
    expect(tokens).toMatch(/--desk-ink: #f5f5f4;/);
    expect(tokens).toMatch(/--desk-gold: #E3B23C;/);
    expect(tokens).toMatch(/--desk-on-gold: #0b0b0d;/);
    // The Desk still resolves through its own tokens, not the site's dark set.
    expect(src).not.toMatch(/var\(--de-(raised|surface|bg|hairline)\b/);
    // No white or paper ground survives from the previous direction.
    expect(src).not.toMatch(/#fbfbfa|#ffffff|#f4f3f1|#fcfaf7/i);
    // Near-black text survives only on gold (buttons, badges, the user's bubble).
    // Judged per CSS rule: a rule that sets --desk-on-gold must also paint gold.
    const rules = [...src.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
    const darkOnDark = rules
      .filter(([, , body]) => /(^|[\s;])color: var\(--desk-on-gold\)/.test(body))
      .filter(([, selector, body]) => !/#E3B23C|--desk-gold/.test(body) && !/\.de-desk-send svg/.test(selector))
      .map(([, selector]) => selector.trim());
    expect(darkOnDark).toEqual([]);
    expect(src).not.toMatch(/--desk-ink: #fff/);
    expect(src).toMatch(/color-scheme: dark;/);
    expect(src).not.toMatch(/color-scheme: light;/);
    // The panel carries a white/10 hairline and the 1px gold cap only: no gold
    // ring and no glow (the mockup's halo was dropped on purpose).
    const shellRule = src.match(/\.de-desk-shell \{[\s\S]*?box-shadow:[^}]+\}/)?.[0] ?? "";
    expect(shellRule).toMatch(/border: 1px solid var\(--desk-border\);/);
    expect(shellRule).not.toMatch(/rgba\(227,178,60/);
    expect(shellRule).not.toMatch(/0 0 \d+px (#E3B23C|rgba\(227)/);
  });

  it("paints the Ask DE chooser as the same black + gold support chrome", () => {
    expect(bottomBarSrc).toMatch(/bg-\[#0b0b0d\] p-5 text-left text-\[#f5f5f4\]/);
    expect(bottomBarSrc).not.toMatch(/bg-\[#fbfbfa\]|bg-\[#151217\]/);
    expect(bottomBarSrc).toMatch(/text-\[#E3B23C\]/);
    const chooser = bottomBarSrc.slice(bottomBarSrc.indexOf('key="ask-de-panel"'), bottomBarSrc.indexOf("</AnimatePresence>"));
    expect(chooser).not.toMatch(/211,18,106|de-magenta|#A30E52/);
  });

  it("keeps the pointer light under Get Support row text dim enough to read through", () => {
    // The hover light is drawn over charcoal rows carrying white ink. Judge it
    // by what it does to the text: stack every layer at its strongest stop over
    // the row's ground and check the ink and the muted blurb still clear 4.5:1.
    const rule = (selector: string) => {
      const start = src.indexOf(`${selector} {`);
      expect(start, selector).toBeGreaterThan(-1);
      return src.slice(start, src.indexOf("}", start)).replace(/\/\*[\s\S]*?\*\//g, "");
    };
    const token = (name: string) => {
      const hex = src.match(new RegExp(`${name}:[^;]*#([0-9a-f]{6})\\)?;`, "i"))?.[1];
      expect(hex, name).toBeTruthy();
      return [0, 2, 4].map((i) => parseInt(hex!.slice(i, i + 2), 16));
    };
    const lin = (c: number) => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    const lum = (rgb: number[]) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
    const contrast = (a: number[], b: number[]) => {
      const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
      return (x + 0.05) / (y + 0.05);
    };
    const over = (ground: number[], rgb: number[], alpha: number) => ground.map((c, i) => c * (1 - alpha) + rgb[i] * alpha);
    // Every rgba() stop in the layer, applied at full strength: the darkest the row can get.
    const light = (ground: number[], css: string) =>
      [...css.matchAll(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/g)].reduce(
        (g, m) => over(g, [Number(m[1]), Number(m[2]), Number(m[3])], Number(m[4])),
        ground,
      );
    // The incident row's resting ground is the row ground with 9% gold mixed in.
    const gold = [0xe3, 0xb2, 0x3c];
    const rows = [
      { ground: token("--desk-box"), layers: [".de-desk-issue-row::before", ".de-desk-issue-row::after"] },
      { ground: over(token("--desk-box"), gold, 0.09), layers: [".de-desk-incident::before"] },
    ];
    for (const row of rows) {
      const lit = row.layers.reduce((g, layer) => light(g, rule(layer)), row.ground);
      const label = row.layers.join(" + ");
      expect(contrast(token("--desk-ink"), lit), label).toBeGreaterThanOrEqual(4.5);
      expect(contrast(token("--desk-ink-muted"), lit), `${label} (muted)`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("never uses a background token as a foreground colour", () => {
    // --desk-surface / --desk-well / --desk-box are grounds, all near-black or
    // charcoal. Setting one as `color` paints dark text on a dark row — which is
    // what happened when paper #f7f5f2 was tokenised by value rather than by
    // role: the same literal was a ground in some rules and text in others.
    const groundTokens = ["--desk-surface", "--desk-well", "--desk-box"];
    for (const token of groundTokens) {
      // (?<![-\\w]) keeps background-color: from counting as a foreground colour
      expect(src).not.toMatch(new RegExp(`(?<![-\\w])color:\\s*var\\(${token}[,)]`));
    }
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
    expect(src).toMatch(/\.de-desk-composer textarea \{[\s\S]*?font-size: 15\.5px;/);
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

  it("styles Ask DE discovery and Get Support issues as grouped stacks", () => {
    expect(src).toMatch(/de-desk-discover/);
    expect(src).toMatch(/de-desk-discover-list/);
    expect(src).toMatch(/ask-de-starter-chips/);
    expect(src).toMatch(/Suggested questions/);
    expect(src).toMatch(/startersForPage/);
    expect(src).toMatch(/de-desk-ticket-upper/);
    expect(src).toMatch(/\.de-desk-issue-list \{[\s\S]*?border-radius: 15px;/);
    expect(src).not.toMatch(/linear-gradient\(135deg, rgba\(211,18,106,0\.16\)/);
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

  it("B1: reopen after mid-greeting cancel snaps to complete greeting + chips", () => {
    expect(src).toMatch(/closing mid-greeting cancels typewrite/);
    expect(src).toMatch(/if \(greetedOnceRef\.current\) \{\s*if \(!greetingComplete\)/);
    expect(src).toMatch(/setGreetingVisible\(full\);\s*setGreetingComplete\(true\);\s*setShowStarterChips\(true\);/);
  });

  it("R2: typing dots stay off under reduced motion; R3: sr-only only while caret hides the p", () => {
    expect(src).toMatch(/typing dots OFF under reduced motion/);
    expect(src).toMatch(/if \(prefersReducedMotion\(\)\) \{\s*setShowTypingDots\(false\);/);
    expect(src).toMatch(/\{showCaret \? \(\s*<span className="sr-only">\{chatMessage\.content\}<\/span>/);
  });

  it("R4: typing-dot colour stays on Desk tokens (skin-independent)", () => {
    expect(src).toMatch(/background: var\(--desk-ink-muted/);
    expect(src).toMatch(/--desk-gold:/);
  });

  it("R1 + B2: nudge uses a real button and paper site tokens (not Desk raised/ink)", () => {
    expect(bottomBarSrc).toMatch(/de-ask-nudge-body/);
    expect(bottomBarSrc).not.toMatch(/ask-de-nudge[\s\S]{0,400}role="dialog"/);
    expect(bottomBarSrc).toMatch(/background: var\(--de-paper-raised\)/);
    expect(bottomBarSrc).toMatch(/border: 1px solid var\(--de-paper-hairline\)/);
    expect(bottomBarSrc).toMatch(/color: var\(--de-bg\)/);
    expect(bottomBarSrc).not.toMatch(/--de-ask-nudge-bg/);
    expect(bottomBarSrc).not.toMatch(/var\(--de-ink/);
  });

  it("keeps every Desk ink token at 4.5:1 or better on every Desk ground", () => {
    // Every colour used as text (white inks, the text gold, the error red and
    // the live green) clears AA on every ground it can sit on, and the
    // near-black ink on a gold or green fill clears it too.
    const hex = (name: string) => {
      const value = src.match(new RegExp(`${name}: (#[0-9a-f]{6});`, "i"))?.[1];
      expect(value, name).toBeTruthy();
      return [1, 3, 5].map((i) => parseInt(value!.slice(i, i + 2), 16));
    };
    const lin = (c: number) => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    const lum = (rgb: number[]) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
    const contrast = (a: number[], b: number[]) => {
      const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
      return (x + 0.05) / (y + 0.05);
    };
    for (const ink of ["--desk-ink", "--desk-ink-muted", "--desk-ink-dim", "--desk-gold-ink", "--desk-red", "--desk-green"]) {
      for (const ground of ["--desk-surface", "--desk-well", "--desk-box", "--desk-box-hover"]) {
        expect(contrast(hex(ink), hex(ground)), `${ink} on ${ground}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    for (const fill of ["--desk-gold", "--desk-green", "--desk-ink-muted"]) {
      expect(contrast(hex("--desk-on-gold"), hex(fill)), `--desk-on-gold on ${fill}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("docks below the live bottom of the site header and the section bar instead of over the nav", () => {
    expect(src).toContain(
      "height: `min(760px, max(440px, calc(100dvh - var(--de-nav-current-bottom, 0px) - var(--de-spy-h, 0px) - ${dockClear} - 16px)))`",
    );
  });

  it("opens with focus on the composer (desktop) or the active tab, not the first header button", () => {
    expect(src).not.toMatch(/getFocusable\(\)\[0\]\?\.focus\(\);/);
    expect(src).toMatch(/id="desk-chat-input"/);
    expect(src).toMatch(/\.de-desk-tab\[aria-selected="true"\]/);
  });

  it("offers a ticket from the conversation and a way to start over, only once the visitor has spoken", () => {
    expect(src).toMatch(/\{visitorHasSpoken \? \(\s*<div className="de-desk-chat-actions"/);
    expect(src).toMatch(/data-testid="button-ticket-from-chat"/);
    expect(src).toMatch(/data-testid="button-start-over-chat"/);
    // The draft never overwrites what the visitor already typed on Get Support.
    expect(src).toMatch(/setSubject\(\(current\) => current \|\| draft\.subject\)/);
    expect(src).toMatch(/setMessage\(\(current\) => current \|\| draft\.message\)/);
    // Start over forgets the stored thread and the server session.
    expect(src).toMatch(/clearDeskChat\(\);[\s\S]{0,400}setAdvisorSessionId\(null\)/);
  });

  it("shows the advisor's next steps under its latest reply, through the client allowlist", () => {
    expect(src).toMatch(/const nextSteps = sanitizeDeskActions\(data\.actions\);/);
    expect(src).toMatch(/chatMessage\.id === lastBotMessageId/);
    expect(src).toMatch(/data-testid="desk-next-steps"/);
    // A phone step says what it does, even when the advisor labelled it "Contact sales".
    expect(src).toMatch(/deskActionLabel\(action, PRIMARY_PHONE\.display\)/);
    // The callback / details / message forms post to the existing advisor action
    // endpoint with the chat session and the honeypot field.
    expect(src).toMatch(/fetch\("\/api\/public\/advisor\/action"/);
    expect(src).toMatch(/website_url: actionFields\.website_url/);
    expect(src).toMatch(/className="de-desk-hp"/);
  });

  it("renders replies as elements, never as injected HTML", () => {
    const rich = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../lib/deskRichText.tsx"), "utf8");
    expect(rich).not.toMatch(/dangerouslySetInnerHTML/);
    expect(src).toMatch(/<DeskRichText text=\{bubbleText\} onNavigate=\{setLocation\} \/>/);
  });

  it("uses a growing composer that sends on Enter, breaks lines on Shift+Enter, and keeps focus while sending", () => {
    expect(src).toMatch(/<textarea\s+ref=\{composerRef\}/);
    expect(src).toMatch(/event\.key === "Enter" && !event\.shiftKey && !event\.nativeEvent\.isComposing/);
    expect(src).toMatch(/readOnly=\{isChatSending\}/);
    expect(src).not.toMatch(/disabled=\{isChatSending\}\s+id="desk-chat-input"/);
  });

  it("offers Try again on a failed send without duplicating the visitor's message", () => {
    expect(src).toMatch(/retryText: content,\s+retryOfId: userMessage\.id,/);
    expect(src).toMatch(/current\.filter\(\(m\) => m\.id !== failed\.id && m\.id !== failed\.retryOfId\)/);
  });

  it("does not yank a reader down; it offers a new-message pill instead", () => {
    expect(src).toMatch(/if \(!atBottomRef\.current && lastChatRole !== "user"\) return;/);
    expect(src).toMatch(/data-testid="desk-jump-latest"/);
  });

  it("has no light ground or dark ink left anywhere in the Desk stylesheet", () => {
    // Leftovers from the white panel would hide where the per-token guards
    // cannot see: a white row painted by literal, or near-black text set by
    // literal on a charcoal ground. Judge every literal by what it paints.
    // Gold fills (the button gradient's bright stop) and the ink-on-gold
    // literal are the only exceptions.
    const css = src.slice(src.indexOf("dangerouslySetInnerHTML"));
    const lum = (hex: string) => {
      const h = hex.length === 4 ? hex.slice(1).split("").map((c) => c + c).join("") : hex.slice(1);
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
      const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const gold = new Set(["#e3b23c", "#edc25a", "#c99a2e", "#edbe4c"]);
    const offenders: string[] = [];
    for (const m of css.matchAll(/([a-z-]+):\s*([^;{}]*);/g)) {
      const [, prop, value] = m;
      for (const hex of value.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi) ?? []) {
        if (gold.has(hex.toLowerCase())) continue;
        const L = lum(hex);
        if (prop.startsWith("background") && L > 0.5) offenders.push(`${prop}: ${hex}`);
        if (prop === "color" && L < 0.1) offenders.push(`${prop}: ${hex}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
