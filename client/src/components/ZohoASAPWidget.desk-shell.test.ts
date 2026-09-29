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

  it("keeps exactly one theme: no second token declaration, no external override", () => {
    // The Desk used to carry two themes at once - a paper set re-declared inside
    // .de-desk-tools-list, dragged back to graphite by an !important file in
    // another module. Both are gone; a Desk colour is wrong in one place only.
    expect(src).not.toMatch(/\.de-desk-tools-list \{[^}]*--desk-ink:/);
    expect(src).not.toMatch(/--desk-shell-/);
    expect(src).not.toMatch(/#d3126a/); // one casing for the brand magenta
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

  it("gives Get Support fields a brighter interactive white outline and magenta focus", () => {
    expect(src).toMatch(/trackDeskSupportFieldSpotlight/);
    expect(src).toMatch(/onPointerMove=\{trackDeskSupportFieldSpotlight\}/);
    expect(src).toMatch(/linear-gradient\(rgba\(255,255,255,0\.88\), rgba\(255,255,255,0\.88\)\)/);
    expect(src).toMatch(/radial-gradient\([\s\S]*--desk-spot-x/);
    expect(src).toMatch(/linear-gradient\(#D3126A, #D3126A\)/);
    expect(src).toMatch(/0 0 0 1px rgba\(255,255,255,0\.5\)/);
  });

  it("paints Get Support issue choices on the graphite token set, never paper", () => {
    expect(src).toMatch(/trackDeskSupportRowGlow/);
    expect(src).toMatch(/\.de-desk-issue-list \{[\s\S]*?background: var\(--desk-box\);/);
    expect(src).toMatch(/\.de-desk-incident \{[\s\S]*?background: var\(--desk-box\);/);
    // The whole Desk resolves through one token set. These were the values the
    // deleted deDeskGraphiteStyle.ts override had to force with !important.
    expect(src).not.toMatch(/#17141f/);
    expect(src).not.toMatch(/#f7f5f2/);
  });

  it("keeps every background declaration off an opaque paper ground", () => {
    // A single-line /background: #fff;/ match is not enough, and shipping one
    // is how a paper ground survived this guard: the remaining white sat at the
    // end of a multi-line composite (a gradient layer, newline, then #fff), so
    // the literal never matched.
    //
    // Matching white anywhere in the declaration is too blunt in the other
    // direction — the Get Support row glow is a radial gradient of white
    // fading to transparent, which is a highlight, not a ground. So split each
    // declaration into its top-level layers and judge those: a layer that is a
    // solid white, or a ground mixed with white, is the defect. White inside a
    // gradient is a stop and is allowed here; how bright that stop may be when
    // it sits under text is the next test's job.
    const layersOf = (value: string) => {
      const layers: string[] = [];
      let depth = 0;
      let current = "";
      for (const ch of value) {
        if (ch === "(") depth += 1;
        if (ch === ")") depth -= 1;
        if (ch === "," && depth === 0) {
          layers.push(current.trim());
          current = "";
          continue;
        }
        current += ch;
      }
      if (current.trim()) layers.push(current.trim());
      return layers;
    };

    const isWhite = /^(#fff|#ffffff|white)$/i;
    const declarations = src.match(/background:([^;]*);/gs) ?? [];
    expect(declarations.length).toBeGreaterThan(20);

    const paperGrounds = declarations.filter((declaration) => {
      const value = declaration.replace(/^background:/, "").replace(/;$/, "");
      return layersOf(value).some(
        (layer) =>
          isWhite.test(layer) ||
          (layer.startsWith("color-mix(") && /#fff\b|#ffffff\b|\bwhite\b/i.test(layer)),
      );
    });
    expect(paperGrounds).toEqual([]);
  });

  it("keeps the pointer light under Get Support row text dim enough to read through", () => {
    // The test above allows white as a gradient stop, and that is how the
    // hover light survived the move to graphite: drawn for the white list at
    // #fff, it sat under white text and measured 1.01:1 with the pointer on
    // the label. So judge the light by what it does to the text: stack every
    // layer at its brightest white stop over the row's hovered ground, and
    // check the white label and the muted blurb both still clear 4.5:1.
    const rule = (selector: string) => {
      const start = src.indexOf(`${selector} {`);
      expect(start, selector).toBeGreaterThan(-1);
      // Judge the declarations, not the comments that explain them.
      return src.slice(start, src.indexOf("}", start)).replace(/\/\*[\s\S]*?\*\//g, "");
    };
    const brightestWhite = (css: string) => {
      const alphas = [...css.matchAll(/rgba\(255,\s*255,\s*255,\s*([\d.]+)\)/g)].map((m) => Number(m[1]));
      if (/#fff\b|#ffffff\b|\bwhite\b/i.test(css)) alphas.push(1);
      return Math.max(0, ...alphas);
    };
    const token = (name: string) => {
      const hex = src.match(new RegExp(`${name}:[^;]*#([0-9a-f]{6})\\)?;`, "i"))?.[1];
      expect(hex, name).toBeTruthy();
      return [0, 2, 4].map((i) => parseInt(hex!.slice(i, i + 2), 16));
    };
    const lin = (c: number) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const lum = (rgb: number[]) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
    const contrast = (a: number[], b: number[]) => {
      const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
      return (x + 0.05) / (y + 0.05);
    };
    const whiteOver = (rgb: number[], alpha: number) => rgb.map((c) => c * (1 - alpha) + 255 * alpha);

    const rows = [
      // Issue rows sit on the list's --desk-box and add a 5% wash on hover.
      { ground: whiteOver(token("--desk-box"), 0.05), layers: [".de-desk-issue-row::before", ".de-desk-issue-row::after"] },
      // The incident row turns --desk-box-hover on hover.
      { ground: token("--desk-box-hover"), layers: [".de-desk-incident::before"] },
    ];
    for (const row of rows) {
      const lit = row.layers.reduce((ground, layer) => whiteOver(ground, brightestWhite(rule(layer))), row.ground);
      const label = row.layers.join(" + ");
      expect(contrast([255, 255, 255], lit), label).toBeGreaterThanOrEqual(4.5);
      expect(contrast(whiteOver(lit, 0.72), lit), `${label} (muted)`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("never uses a background token as a foreground colour", () => {
    // --desk-surface / --desk-well / --desk-box are grounds, all near-black.
    // Setting one as `color` paints dark text on a dark row — which is what
    // happened when paper #f7f5f2 was tokenised by value rather than by role:
    // the same literal was a ground in some rules and text in others.
    const groundTokens = ["--desk-surface", "--desk-well", "--desk-box"];
    for (const token of groundTokens) {
      expect(src).not.toMatch(new RegExp(`color:\\s*var\\(${token}[,)]`));
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
    expect(src).toMatch(/--desk-pink:/);
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
});
