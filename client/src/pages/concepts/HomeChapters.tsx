// Concept v4 (Exploration Mode, 2026-10-18): chapter layout at /concepts/home-chapters.
// Renders every section of the live homepage (HomepageV8) in full, in the same order, so no content is lost.
// The chapter shell (sticky chapter nav, chapter rhythm) is the new layer; section components are reused as-is.
// Not the production homepage. The live / is HomepageV8 and stays unchanged until Joe picks.
import "../versions/v8/v8.css";
import "./home-chapters.css";
import "../versions/v8/v8-dashboard.css";
import { useRef, useState, useEffect, createRef, type RefObject } from "react";
import { ChapterRail } from "./ChapterRail";
import { useCardObjects } from "./CardObjects";
import { useTheme, ThemeToggle } from "./ThemeToggle";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { PRIMARY_PHONE } from "@/data/companyContact";
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

// Same section order and ids as HomepageV8, so every section is present.
const chapters = [
  { id: "hero", label: "Home", render: () => <><div className="v8s-01"><V8Hero /></div><div className="v8s-02"><V8WhyWeExist /></div></> },
  { id: "stats", label: "Why DE", render: () => <div className="v8s-03"><V8ThreatsAreReal /></div> },
  { id: "challenges", label: "Problems", render: () => <div className="v8s-04"><V8WhatWeTackle /></div> },
  { id: "services", label: "How it works", render: () => <div className="v8s-05"><V8Services /></div> },
  { id: "protection", label: "Protect", render: () => <div className="v8s-06"><V8EightBlocks /></div> },
  { id: "testimonials", label: "Proof", render: () => <div className="v8s-07"><V8ClientProof /></div> },
  { id: "trust", label: "Trust", render: () => <div className="v8s-08"><V8WhyArizona /></div> },
  { id: "team", label: "Team", render: () => <div className="v8s-09"><V8Team /></div> },
  { id: "industries", label: "Industries", render: () => <div className="v8s-10"><V8Industries /></div> },
  { id: "pricing", label: "Packages", render: () => <div className="v8s-11"><V8Pricing /></div> },
  { id: "insights", label: "Insights", render: () => <><div className="v8s-12"><V8ThreatsInsights /></div><div className="v8s-13"><V8LeadForm /></div></> },
  { id: "faq", label: "FAQ", render: () => <div className="v8s-14"><V8Faq /></div> },
  { id: "cta", label: "Next step", render: () => <div className="v8s-15"><V8NextStep /></div> },
  { id: "contact", label: "Contact", render: () => <div className="v8s-16"><V8ContactFooter /></div> },
];

const navItems = ["hero", "stats", "services", "pricing", "testimonials", "team", "insights", "contact"];

// Card rows that become horizontal rails on this page (content unchanged). Selector = the existing grid.
const rails: Record<string, { selector: string; label: string }> = {
  industries: { selector: ".ind-rail", label: "industry" },
  testimonials: { selector: ".proof-cells", label: "outcome" },
};

// ILLUSTRATIVE kie.ai plates (abstract, no people, no text), faint atmosphere behind three chapters.
const plates: Record<string, string> = {
  hero: "/concepts/monday/light-hero.webp",
  stats: "/concepts/monday/light-section.webp",
  protection: "/concepts/monday/light-dark-stage.webp",
  contact: "/concepts/monday/light-close.webp",
};

export function HomeChapters(): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  const { theme, toggle } = useTheme();
  const [active, setActive] = useState("hero");
  const [closing, setClosing] = useState(false);
  const sectionRefs = useRef<Record<string, RefObject<HTMLElement>>>(
    Object.fromEntries(chapters.map((c) => [c.id, createRef<HTMLElement>()])),
  );
  useSpotlight(rootRef);
  useCardObjects(rootRef);
  useSEO({
    title: "Concept: chapter homepage",
    description: "Review concept. Not the live homepage.",
    canonical: "/",
    noIndex: true,
  });

  // Depth parallax on the plates: each plate drifts against its own section. Off under reduced motion.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const layers = Array.from(document.querySelectorAll<HTMLElement>(".hc-plate[data-depth]"));
    if (layers.length === 0) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const vh = window.innerHeight || 1;
      for (const el of layers) {
        const rect = (el.parentElement ?? el).getBoundingClientRect();
        const progress = Math.max(-1, Math.min(1, (rect.top + rect.height / 2 - vh / 2) / vh));
        const depth = Number(el.dataset.depth) || 0;
        el.style.transform = `translate3d(0, ${(progress * depth * 120).toFixed(1)}px, 0) scale(1.08)`;
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const sections = chapters
      .map((c) => document.getElementById(c.id))
      .filter((n): n is HTMLElement => n !== null);
    if (!("IntersectionObserver" in window) || sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  // The site menu is fixed above this page; dock the chapter pill under its bottom edge, wherever that is.
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>(".hc-nav");
    if (!nav) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const menu = document.querySelector<HTMLElement>(".mega-menu-container");
      const bottom = menu ? Math.max(0, Math.round(menu.getBoundingClientRect().bottom)) : 0;
      (nav.closest<HTMLElement>(".hc") ?? nav).style.setProperty("--hc-nav-top", `${bottom}px`);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Scrollcraft signature (scrollcraft/builds/home-mesh/BRIEF.md): once the close is on screen the
  // chapter pill folds into one assessment button with the principal's face. Scroll back and it unfolds.
  useEffect(() => {
    const close = document.getElementById("cta");
    if (!close || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      ([entry]) => setClosing(entry.isIntersecting || entry.boundingClientRect.top < 0),
      { rootMargin: "0px 0px -35% 0px" },
    );
    observer.observe(close);
    return () => observer.disconnect();
  }, []);

  // Scrollcraft peak: the monitoring hand-off (Signal, human triage, named owner) is drawn by scroll.
  // Writes --hc-handoff (0 to 1) on the list; the named owner lights at the end. Static under reduced motion.
  useEffect(() => {
    const list = document.querySelector<HTMLElement>(".v8s-12 .dg");
    if (!list) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      list.style.setProperty("--hc-handoff", "1");
      const last = list.lastElementChild as HTMLElement | null;
      if (last) list.style.setProperty("--hc-handoff-len", `${Math.max(0, last.offsetTop - 36)}px`);
      list.classList.add("is-owned");
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const vh = window.innerHeight || 1;
      const rect = list.getBoundingClientRect();
      // 0 when the list's top reaches 80% of the viewport, 1 when its bottom reaches 45%.
      const start = vh * 0.8;
      const end = vh * 0.45;
      const span = rect.height + (start - end);
      const p = Math.max(0, Math.min(1, (start - rect.top) / span));
      list.style.setProperty("--hc-handoff", p.toFixed(3));
      const last = list.lastElementChild as HTMLElement | null;
      if (last) list.style.setProperty("--hc-handoff-len", `${Math.max(0, last.offsetTop - 36)}px`);
      list.classList.toggle("is-owned", p >= 0.98);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="v8 hc min-h-screen" ref={rootRef} data-theme={theme}>
      <OrganizationJsonLd />
      <WebSiteJsonLd />
      <MegaMenu />
      <SiteBottomBar autohide />
      <main id="home-main" className="contents">
        <nav className={`hc-nav${closing ? " is-closing" : ""}`} aria-label="Sections">
          <ul aria-hidden={closing || undefined}>
            {navItems.map((id) => {
              const c = chapters.find((x) => x.id === id);
              return (
                <li key={id}>
                  <a href={`#${id}`} tabIndex={closing ? -1 : undefined} className={`hc-nav__link${active === id ? " is-active" : ""}`} aria-current={active === id ? "location" : undefined}>
                    {c?.label}
                  </a>
                </li>
              );
            })}
          </ul>
          <Link href="/book" className="hc-nav__principal" aria-hidden={!closing || undefined} tabIndex={closing ? undefined : -1}>
            <img src="/images/founder/joe-petro-studio-blazer-white.webp" alt="" width={32} height={32} />
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
        <section className="hc-poster" aria-labelledby="hc-poster-title">
          <div className="hc-poster__dark" aria-hidden="true" />
          <div className="hc-wrap hc-poster__grid">
            <div className="hc-poster__copy">
              <p className="hc-poster__eyebrow">Arizona MSP. Cybersecurity &amp; Managed IT.</p>
              <h1 id="hc-poster-title" className="hc-poster__title">
                Cybersecurity-first IT<br />that powers<br />your business.
              </h1>
              <p className="hc-poster__sub">Managed IT, security and compliance for Arizona businesses that can&rsquo;t afford downtime.</p>
              <div className="hc-poster__actions">
                <Link href="/book" className="hc-poster__btn">Get a Cyber Risk Assessment <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
                <a href={PRIMARY_PHONE.telHref} className="hc-poster__call">Call {PRIMARY_PHONE.display}</a>
              </div>
            </div>
            <figure className="hc-poster__figure">
              <img src="/images/founder/joe-petro-studio-blazer-white.jpg" alt="Joseph Petro, Founder of Digerati Experts" width={900} height={1100} {...({ fetchpriority: "high" } as Record<string, string>)} />
              <figcaption><span>Joseph Petro</span><span>Founder &amp; Chief Technology Strategist</span></figcaption>
            </figure>
          </div>
        </section>
        {chapters.map((c) => (
          <section key={c.id} id={c.id} ref={sectionRefs.current[c.id]} className={`hc-section${plates[c.id] ? " hc-section--plate" : ""}`} aria-label={c.label}>
            {plates[c.id] && (
              <img className="hc-plate" src={plates[c.id]} alt="" aria-hidden="true" width={1600} height={900} loading={c.id === "hero" ? "eager" : "lazy"} data-depth="0.18" />
            )}
            {c.render()}
            {rails[c.id] && <ChapterRail sectionRef={sectionRefs.current[c.id]} gridSelector={rails[c.id].selector} label={rails[c.id].label} />}
          </section>
        ))}
      </main>
    </div>
  );
}
