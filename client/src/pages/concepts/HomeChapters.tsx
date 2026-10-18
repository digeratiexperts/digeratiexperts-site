// Concept v4 (Exploration Mode, 2026-10-18): chapter site at /concepts/home-chapters.
// Vertical full-screen chapters with a chapter nav; horizontal carousels inside chapters (exosource pattern).
// Copy is existing site copy. Background plates are ILLUSTRATIVE (kie.ai, abstract, no people, no text).
// Not the production homepage. The live / is HomepageV8.
import "../versions/v8/v8.css";
import "../versions/v8/v8-dashboard.css";
import "./home-chapters.css";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Link } from "wouter";
import { ArrowRight, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { MegaMenu } from "@/components/MegaMenu";
import { SiteBottomBar } from "@/components/SiteBottomBar";
import { useSEO } from "@/hooks/useSEO";
import { OrganizationJsonLd, WebSiteJsonLd } from "@/components/JsonLd";
import { PRIMARY_PHONE } from "@/data/companyContact";
import { pricingTiers } from "@/data/pricing";
import { V8ContactFooter } from "@/pages/versions/v8/sections/16-contact-footer";

const chapters = [
  { id: "what", label: "What we do" },
  { id: "how", label: "How it works" },
  { id: "plans", label: "Plans" },
  { id: "start", label: "Start" },
];

const areas = [
  { title: "Cyber Risk Assessment", lines: ["Identity and sign-in", "Endpoints and patching", "Email security", "Backups and recovery", "Foundational security controls"], href: "/book", cta: "Start an assessment" },
  { title: "Managed IT", lines: ["Help desk and ticket triage", "Endpoint management", "Network and Wi-Fi support", "Monthly reviews with your team"], href: "/solutions/managed-it-support", cta: "See managed IT" },
  { title: "Backup & recovery", lines: ["Backup coverage review", "Offsite copies", "Restore testing", "Recovery planning with your team"], href: "/solutions/backup-disaster-recovery", cta: "See backup & recovery" },
  { title: "Compliance", lines: ["Policy and access reviews", "Staff security training", "Evidence for audits", "Industry-specific requirements"], href: "/about/compliance", cta: "See compliance" },
];

const steps = [
  { title: "Assess", body: "We review identity, endpoints, email, backups and foundational security controls." },
  { title: "Roadmap", body: "A prioritized plan sized to your environment, not a generic package." },
  { title: "Implement", body: "We make the fixes that reduce the most risk first, in an order you can follow." },
  { title: "Keep it running", body: "Ongoing management and regular strategy reviews, so the gains hold." },
];

const highlights: Record<string, string[]> = {
  it: ["Managed IT & help desk", "Baseline identity & endpoint", "Entry cybersecurity"],
  office: ["Everything in IT", "Managed network", "Endpoint backup"],
  business: ["Identity, endpoint, email", "SOC / MDR", "BCDR strategy reviews"],
  enterprise: ["Advanced governance", "Audit-ready reporting", "Quarterly strategy"],
};

function Carousel({ label, count, children }: { label: string; count: number; children: ReactNode }): JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const go = (next: number) => {
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.max(0, Math.min(count - 1, next));
    const slide = track.children[clamped] as HTMLElement | undefined;
    slide?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    setIndex(clamped);
  };

  const onScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    const w = (track.children[0] as HTMLElement | undefined)?.offsetWidth ?? 1;
    setIndex(Math.round(track.scrollLeft / (w + 20)));
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1); }
  };

  return (
    <div className="hc-carousel" role="region" aria-roledescription="carousel" aria-label={label}>
      <div className="hc-carousel__track" ref={trackRef} onScroll={onScroll} onKeyDown={onKey} tabIndex={0} aria-label={`${label}, use arrow keys to move`}>
        {children}
      </div>
      <div className="hc-carousel__bar">
        <button type="button" className="hc-arrow" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous">
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="hc-dots" role="group" aria-label="Choose slide">
          {Array.from({ length: count }, (_, i) => (
            <button key={i} type="button" className={`hc-dot${i === index ? " is-on" : ""}`} onClick={() => go(i)} aria-label={`Slide ${i + 1} of ${count}`} aria-current={i === index ? "true" : undefined} />
          ))}
        </div>
        <button type="button" className="hc-arrow" onClick={() => go(index + 1)} disabled={index >= count - 1} aria-label="Next">
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function HomeChapters(): JSX.Element {
  const [active, setActive] = useState("what");

  useSEO({
    title: "Concept: chapter homepage",
    description: "Review concept. Not the live homepage.",
    canonical: "/",
    noIndex: true,
  });

  useEffect(() => {
    const sections = chapters
      .map((c) => document.getElementById(`hc-${c.id}`))
      .filter((n): n is HTMLElement => n !== null);
    if (!("IntersectionObserver" in window) || sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id.replace("hc-", ""));
        }
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="v8 hc min-h-screen text-white">
      <OrganizationJsonLd />
      <WebSiteJsonLd />
      <MegaMenu />
      <SiteBottomBar autohide />
      <main id="home-main" className="contents">
        <nav className="hc-nav" aria-label="Chapters">
          <ul>
            {chapters.map((c) => (
              <li key={c.id}>
                <a href={`#hc-${c.id}`} className={`hc-nav__link${active === c.id ? " is-active" : ""}`} aria-current={active === c.id ? "location" : undefined}>
                  {c.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <section id="hc-hero" className="hc-chapter hc-chapter--hero" aria-labelledby="hc-hero-title">
          <img className="hc-plate" src="/concepts/monday/hero-plate.webp" alt="" aria-hidden="true" width={1600} height={900} loading="eager" />
          <div className="hc-wrap hc-hero__inner">
            <p className="hc-pill">Arizona managed IT and cybersecurity</p>
            <h1 id="hc-hero-title" className="hc-h1">
              <span className="whitespace-nowrap">Cybersecurity-first</span> IT for Arizona businesses.
            </h1>
            <p className="hc-lede">
              Managed IT, security and compliance for businesses that can&rsquo;t afford downtime. Every engagement starts with a Cyber Risk Assessment, so the plan fits how your business runs.
            </p>
            <div className="hc-actions">
              <Link href="/book" className="hc-btn hc-btn--primary">Get a Cyber Risk Assessment <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
              <Link href="/proactive-ecosystem-pricing" className="hc-btn hc-btn--ghost">See plans</Link>
            </div>
            <p className="hc-note">Prefer to talk? <a href={PRIMARY_PHONE.telHref} className="hc-link">Call {PRIMARY_PHONE.display}</a></p>
            <a href="#hc-what" className="hc-scroll-cue">Scroll to see what we do</a>
          </div>
        </section>

        <section id="hc-what" className="hc-chapter" aria-labelledby="hc-what-title">
          <div className="hc-wrap">
            <h2 id="hc-what-title" className="hc-h2">What we do</h2>
            <Carousel label="Services" count={areas.length}>
              {areas.map((a) => (
                <article key={a.title} className="hc-slide hc-card">
                  <span className="hc-iconwell" aria-hidden="true"><BarMark /></span>
                  <h3 className="hc-h3">{a.title}</h3>
                  <ul className="hc-list">
                    {a.lines.map((l) => (
                      <li key={l}><Check className="h-4 w-4" aria-hidden="true" />{l}</li>
                    ))}
                  </ul>
                  <Link href={a.href} className="hc-link">{a.cta} <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
                </article>
              ))}
            </Carousel>
          </div>
        </section>

        <section id="hc-how" className="hc-chapter hc-chapter--plate" aria-labelledby="hc-how-title">
          <img className="hc-plate" src="/concepts/monday/showcase-plate.webp" alt="" aria-hidden="true" width={1600} height={900} loading="lazy" />
          <div className="hc-wrap">
            <h2 id="hc-how-title" className="hc-h2">How it works</h2>
            <Carousel label="Steps" count={steps.length}>
              {steps.map((s, i) => (
                <article key={s.title} className="hc-slide hc-card hc-card--glass">
                  <span className="hc-step__n">{i + 1} / {steps.length}</span>
                  <h3 className="hc-h3">{s.title}</h3>
                  <p className="hc-body">{s.body}</p>
                </article>
              ))}
            </Carousel>
          </div>
        </section>

        <section id="hc-plans" className="hc-chapter" aria-labelledby="hc-plans-title">
          <div className="hc-wrap">
            <h2 id="hc-plans-title" className="hc-h2">Four operating models. One matched to your environment.</h2>
            <Carousel label="Plans" count={pricingTiers.length}>
              {pricingTiers.map((tier) => (
                <article key={tier.label} className="hc-slide hc-card">
                  <h3 className="hc-h3">{tier.label}</h3>
                  <ul className="hc-list">
                    {(highlights[tier.name.toLowerCase()] ?? []).map((h) => (
                      <li key={h}><Check className="h-4 w-4" aria-hidden="true" />{h}</li>
                    ))}
                  </ul>
                  <Link href="/proactive-ecosystem-pricing" className="hc-link">Compare the plans <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
                </article>
              ))}
            </Carousel>
          </div>
        </section>

        <section id="hc-start" className="hc-chapter hc-chapter--plate hc-chapter--close" aria-labelledby="hc-start-title">
          <img className="hc-plate" src="/concepts/monday/close-plate.webp" alt="" aria-hidden="true" width={1600} height={900} loading="lazy" />
          <div className="hc-wrap hc-close">
            <h2 id="hc-start-title" className="hc-h2 hc-center">Start with a Cyber Risk Assessment.</h2>
            <p className="hc-body hc-center">Tell us about your environment. We&rsquo;ll follow up on the assessment, no hard sell.</p>
            <p className="hc-body hc-center">Assessments and roadmaps are led by the founder. <Link href="/about/team" className="hc-link">Meet the team</Link></p>
            <div className="hc-actions hc-center">
              <Link href="/book" className="hc-btn hc-btn--primary">Get a Cyber Risk Assessment <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
              <a href={PRIMARY_PHONE.telHref} className="hc-btn hc-btn--ghost">Call {PRIMARY_PHONE.display}</a>
            </div>
          </div>
        </section>

        <div className="v8s-16"><V8ContactFooter /></div>
      </main>
    </div>
  );
}

function BarMark(): JSX.Element {
  return (
    <svg viewBox="0 0 48 48" width="28" height="28" role="presentation" focusable="false">
      <rect x="8" y="12" width="32" height="6" rx="3" fill="currentColor" />
      <rect x="8" y="21" width="24" height="6" rx="3" fill="currentColor" opacity="0.7" />
      <rect x="8" y="30" width="16" height="6" rx="3" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

