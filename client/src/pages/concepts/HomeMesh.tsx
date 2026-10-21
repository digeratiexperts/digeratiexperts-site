// Concept (Exploration, 2026-10-21): /concepts/home-mesh, the live homepage (HomepageV8 at /) and the
// chapter concept (/concepts/home-chapters) meshed into one page. Joe: "I want both very much".
// Spec, section by section: scrollcraft/builds/home-mesh/MESH.md. Not the production homepage.
//
// How the two are joined:
// - Content, order and wording are the live page's: the same 16 section components, unchanged.
// - The live page's day/night rhythm is kept. Its light chapters stay on the live light styling
//   ("v8" skin); its dark chapters take the concept's dark skin ("hc": charcoal ground, white
//   object cards, large type).
// - The concept's toggle switches every concept-skinned band to the concept's light theme ("Day");
//   the hero and the contact footer stay dark in both, so the page opens and closes on the same note.
// - The live hero is kept whole and gains the founder portrait from the concept, with the
//   assessment preview laid over it.
// - One chapter pill (the concept's), docked under the site menu, carrying the theme toggle and the
//   Scrollcraft signature; the live page's own scroll-snap and spy row are not mounted here.
import "../versions/v8/v8.css";
import "./home-chapters.css";
import "../versions/v8/v8-dashboard.css";
import "./home-mesh.css";
import { useRef, createRef, type ReactNode, type RefObject } from "react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { MegaMenu } from "@/components/MegaMenu";
import { SiteBottomBar } from "@/components/SiteBottomBar";
import { useSEO } from "@/hooks/useSEO";
import { OrganizationJsonLd, WebSiteJsonLd } from "@/components/JsonLd";
import { useSpotlight } from "../versions/v8/useSpotlight";
import { V8Hero } from "../versions/v8/sections/01-hero";
import { V8WhyWeExist } from "../versions/v8/sections/02-why-we-exist";
import { V8ThreatsAreReal } from "../versions/v8/sections/03-threats-are-real";
import { V8WhatWeTackle } from "../versions/v8/sections/04-what-we-tackle";
import { V8Services } from "../versions/v8/sections/05-services";
import { V8EightBlocks } from "../versions/v8/sections/06-eight-blocks";
import { V8ClientProof } from "../versions/v8/sections/07-client-proof";
import { V8WhyArizona } from "../versions/v8/sections/08-why-arizona";
import { V8Team } from "../versions/v8/sections/09-team";
import { V8Industries } from "../versions/v8/sections/10-industries";
import { V8Pricing } from "../versions/v8/sections/11-pricing";
import { V8ThreatsInsights } from "../versions/v8/sections/12-threats-insights";
import { V8LeadForm } from "../versions/v8/sections/13-lead-form";
import { V8Faq } from "../versions/v8/sections/14-faq";
import { V8NextStep } from "../versions/v8/sections/15-next-step";
import { V8ContactFooter } from "../versions/v8/sections/16-contact-footer";
import { useCardObjects, type Placement } from "./CardObjects";
import { useTheme, ThemeToggle, type Theme } from "./ThemeToggle";
import { useActiveChapter, useClosing, useHandoff, useNavDock } from "./chapterChrome";

/** "v8": the live page's own styling. "hc": the concept's skin, dark at night and light by day. "hc-dark": concept skin, dark in both. */
type Skin = "v8" | "hc" | "hc-dark";
type Part = { wrap: string; skin: Skin; node: ReactNode };
type Chapter = { id: string; label: string; parts: Part[] };

const FOUNDER = "/images/founder/joe-petro-studio-blazer-white";

function FounderPortrait(): JSX.Element {
  return (
    <figure className="hm-portrait">
      <picture>
        <source srcSet={`${FOUNDER}.webp`} type="image/webp" />
        <img src={`${FOUNDER}.jpg`} alt="Joseph Petro, Founder of Digerati Experts" width={768} height={1024} {...({ fetchpriority: "high" } as Record<string, string>)} />
      </picture>
      <figcaption>
        <span>Joseph Petro</span>
        <span>Founder &amp; Chief Technology Strategist</span>
      </figcaption>
    </figure>
  );
}

// Same order, ids and section components as HomepageV8. Skins follow the live page's rhythm.
const chapters: Chapter[] = [
  {
    id: "hero",
    label: "Home",
    parts: [
      { wrap: "v8s-01", skin: "v8", node: <V8Hero aside={<FounderPortrait />} /> },
      { wrap: "v8s-02", skin: "v8", node: <V8WhyWeExist /> },
    ],
  },
  { id: "stats", label: "Why DE", parts: [{ wrap: "v8s-03", skin: "hc", node: <V8ThreatsAreReal /> }] },
  { id: "challenges", label: "Problems", parts: [{ wrap: "v8s-04", skin: "v8", node: <V8WhatWeTackle /> }] },
  { id: "services", label: "How it works", parts: [{ wrap: "v8s-05", skin: "hc", node: <V8Services /> }] },
  { id: "protection", label: "Protect", parts: [{ wrap: "v8s-06", skin: "v8", node: <V8EightBlocks /> }] },
  { id: "testimonials", label: "Proof", parts: [{ wrap: "v8s-07", skin: "hc", node: <V8ClientProof /> }] },
  { id: "trust", label: "Trust", parts: [{ wrap: "v8s-08", skin: "v8", node: <V8WhyArizona /> }] },
  { id: "team", label: "Team", parts: [{ wrap: "v8s-09", skin: "hc", node: <V8Team /> }] },
  { id: "industries", label: "Industries", parts: [{ wrap: "v8s-10", skin: "hc", node: <V8Industries /> }] },
  { id: "pricing", label: "Packages", parts: [{ wrap: "v8s-11", skin: "hc", node: <V8Pricing /> }] },
  {
    id: "insights",
    label: "Insights",
    parts: [
      { wrap: "v8s-12", skin: "hc", node: <V8ThreatsInsights /> },
      { wrap: "v8s-13", skin: "v8", node: <V8LeadForm /> },
    ],
  },
  { id: "faq", label: "FAQ", parts: [{ wrap: "v8s-14", skin: "v8", node: <V8Faq /> }] },
  { id: "cta", label: "Next step", parts: [{ wrap: "v8s-15", skin: "v8", node: <V8NextStep /> }] },
  { id: "contact", label: "Contact", parts: [{ wrap: "v8s-16", skin: "hc-dark", node: <V8ContactFooter /> }] },
];

const chapterIds = chapters.map((c) => c.id);
const navItems = ["hero", "stats", "services", "pricing", "testimonials", "team", "insights", "contact"];

// Objects go where a card has room for one and carries a single idea. The trust pillars keep the
// live icon rows (the photograph and the findings sheet already carry that chapter).
const meshObjects: Record<string, Placement[]> = {
  hero: [{ selector: ".v8s-02 .claims > *", objects: ["shield", "people", "chart"], size: 96 }],
  challenges: [{ selector: ".problems > .problem", objects: ["lock", "backup", "clipboard", "email", "bell", "eye"], size: 96 }],
  services: [{ selector: ".svc-paths .svc-path", objects: ["server", "people", "clipboard"], size: 120 }],
  testimonials: [{ selector: ".proof-cells > li", objects: ["network", "eye", "headset"], size: 110 }],
  pricing: [{ selector: ".pricing-grid .pricing-card", objects: ["laptop", "network", "shield", "building"], size: 110 }],
};

function bandTheme(skin: Skin, theme: Theme): Theme | undefined {
  if (skin === "v8") return undefined;
  if (skin === "hc-dark") return "dark";
  return theme;
}

export function HomeMesh(): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  const { theme, toggle } = useTheme({ applyToRoot: false });
  const sectionRefs = useRef<Record<string, RefObject<HTMLElement>>>(
    Object.fromEntries(chapters.map((c) => [c.id, createRef<HTMLElement>()])),
  );
  useSpotlight(rootRef);
  useCardObjects(rootRef, meshObjects);
  useNavDock();
  useHandoff();
  const active = useActiveChapter(chapterIds, "hero");
  const closing = useClosing("cta");
  useSEO({
    title: "Concept: homepage mesh",
    description: "Review concept. Not the live homepage.",
    canonical: "/",
    noIndex: true,
  });

  return (
    <div className={`v8 hm hm--${theme} min-h-screen`} ref={rootRef}>
      <OrganizationJsonLd />
      <WebSiteJsonLd />
      <MegaMenu />
      <SiteBottomBar autohide />
      <main id="home-main" className="contents">
        {/* The pill reads the concept's tokens from this wrapper; display: contents keeps it out of layout. */}
        <div className="hc v8 hm-chrome" data-theme={theme}>
          <nav className={`hc-nav${closing ? " is-closing" : ""}`} aria-label="Sections">
            <ul aria-hidden={closing || undefined}>
              {navItems.map((id) => {
                const c = chapters.find((x) => x.id === id);
                return (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      tabIndex={closing ? -1 : undefined}
                      className={`hc-nav__link${active === id ? " is-active" : ""}`}
                      aria-current={active === id ? "location" : undefined}
                    >
                      {c?.label}
                    </a>
                  </li>
                );
              })}
            </ul>
            <Link href="/book" className="hc-nav__principal" aria-hidden={!closing || undefined} tabIndex={closing ? undefined : -1}>
              <img src={`${FOUNDER}.webp`} alt="" width={32} height={32} />
              <span className="hc-nav__principal-copy">
                <span>Get a Cyber Risk Assessment</span>
                <span>Principal-led · Joseph Petro</span>
              </span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <div className="hc-nav__toggle">
              <ThemeToggle theme={theme} onToggle={toggle} />
            </div>
          </nav>
        </div>

        {chapters.map((c) => (
          <section key={c.id} id={c.id} ref={sectionRefs.current[c.id]} className="hc-section hm-chapter" aria-label={c.label}>
            {c.parts.map((part) => {
              const inner = <div className={part.wrap}>{part.node}</div>;
              if (part.skin === "v8") return <div key={part.wrap} className="hm-band hm-band--v8">{inner}</div>;
              return (
                <div key={part.wrap} className="hc v8 hm-band hm-band--hc" data-theme={bandTheme(part.skin, theme)}>
                  {inner}
                </div>
              );
            })}
          </section>
        ))}
      </main>
    </div>
  );
}
