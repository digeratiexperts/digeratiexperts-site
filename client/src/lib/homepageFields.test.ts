import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("homepage chapter fields", () => {
  const css = readFileSync(path.resolve(__dirname, "../index.css"), "utf8");
  const homepage = readFileSync(
    path.resolve(__dirname, "../pages/DigeratiHomepage.tsx"),
    "utf8",
  );
  const insights = readFileSync(
    path.resolve(__dirname, "../pages/sections/DigeratiThreatsInsightsSection.tsx"),
    "utf8",
  );

  it("defines grain, paper grain, film overlay, lighting, and surface fade as opt-in utilities", () => {
    expect(css).toContain("--de-field-grain:");
    expect(css).toContain("--de-field-grain-paper:");
    expect(css).toContain(".de-field-grain {");
    expect(css).toContain(".de-field-grain-paper {");
    expect(css).toContain(".de-field-grain-film::after");
    expect(css).toContain(".de-field-lit::before");
    expect(css).toContain(".de-chapter-fade-to-surface");
    expect(css).toContain("isolation: isolate");
  });

  it("keeps lighting as radial washes, not a violet fill", () => {
    const litBlock = css.slice(css.indexOf(".de-field-lit::before"), css.indexOf(".de-field-lit::before") + 520);
    expect(litBlock).toContain("rgba(211, 18, 106");
    expect(litBlock).toContain("rgba(91, 69, 224");
    expect(litBlock).not.toMatch(/background-color:\s*#(5B45E0|8B5CF6|7c3aed)/i);
  });

  const section = (name: string) =>
    readFileSync(path.resolve(__dirname, `../pages/sections/${name}.tsx`), "utf8");

  it("composes every homepage chapter from the shared HomeChapter grammar, never a rounded island", () => {
    // 2026-09-30: Joe called the page "four different websites". One
    // primitive supplies the field, the seam, the container and the header
    // for every chapter; no section paints its own island or style box.
    const chapters = [
      "DigeratiAlertBanner",
      "DigeratiStatsSection",
      "DigeratiWhatWeTackleSection",
      "DigeratiServicesSection",
      "DigeratiHowWeProtectSection",
      "DigeratiTestimonialsSection",
      "HomepageProofSection",
      "DigeratiTrustPhotoSection",
      "DigeratiMeetExpertsSection",
      "DigeratiIndustriesSection",
      "DigeratiPricingSection",
      "DigeratiThreatsInsightsSection",
      "DigeratiAIAssistanceSection",
      "DigeratiLeadFormSection",
      "DigeratiFAQSection",
      "DigeratiNewsletterSection",
      "DigeratiCTASection",
      "DigeratiContactSection",
    ];
    for (const name of chapters) {
      const src = section(name);
      expect(src, name).toContain('from "@/components/home/HomeChapter"');
      expect(src, name).toContain("<HomeChapter tone=");
      expect(src, name).not.toContain("de-paper-island");
      expect(src, name).not.toContain("de-style-box");
    }
  });

  it("steps the field between insights and the pricing well so the pair is not two slabs", () => {
    expect(section("DigeratiPricingSection")).toContain('<HomeChapter tone="well"');
    expect(insights).toContain('<HomeChapter tone="surface"');
    expect(homepage).toContain("DigeratiThreatsInsightsSection");
    expect(homepage).toContain("DigeratiPricingSection");
  });

  it("chapters take their natural height; snap targets keep only the chrome offset", () => {
    const block = css.slice(css.indexOf(".scroll-snap-chapter {"), css.indexOf(".scroll-snap-chapter {") + 200);
    expect(block).toContain("scroll-margin-top");
    expect(block).not.toContain("min-height");
  });

  it("FAQ is a paper chapter with white magenta-rail rows", () => {
    const faq = section("DigeratiFAQSection");
    expect(faq).toContain('<HomeChapter tone="paper"');
    expect(faq).toContain("de-paper-faq-item");
    expect(faq).not.toContain("de-hud-card");
    expect(css).toContain(".de-paper-faq-item {");
    expect(css).toContain("inset 3px 0 0 #d3126a");
    expect(css).toContain("background-color: var(--de-paper-raised)");
  });

  it("homepage threat tiles stay white on the dark field; the empty state and promise cards use the shared dark card", () => {
    expect(insights).toContain("de-paper-on-well");
    expect(insights).toContain("bg-white");
    expect(insights).toContain('text-[#1A1228]');
    expect(insights).toContain("cardDark");
    expect(insights).not.toContain("from-[#18141f]");
    expect(css).toContain(".de-paper-on-well {");
    const ai = section("DigeratiAIAssistanceSection");
    expect(ai).toContain("cardDark");
    expect(ai).not.toContain("de-paper-on-well");
    expect(ai).toContain("Coverage with Context");
  });
});
