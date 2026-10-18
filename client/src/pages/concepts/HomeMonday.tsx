// Concept v2 (Exploration Mode, 2026-10-18): light-first, product-led homepage at /concepts/home-monday.
// Structural cues from monday.com (light canvas, product window hero, pill use-case tabs, soft panels).
// Identity kept: DE palette, real founder photo, no invented logos, metrics or illustrated characters.
// Not the production homepage. The live / is HomepageV8.
import "../versions/v8/v8.css";
import "../versions/v8/v8-dashboard.css";
import "./home-monday.css";
import "./home-monday-motion.css";
import { useEffect, useRef, useState, type RefObject } from "react";
import { Link } from "wouter";
import { ArrowRight, Check } from "lucide-react";
import { MegaMenu } from "@/components/MegaMenu";
import { SiteBottomBar } from "@/components/SiteBottomBar";
import { useSEO } from "@/hooks/useSEO";
import { OrganizationJsonLd, WebSiteJsonLd } from "@/components/JsonLd";
import { PRIMARY_PHONE } from "@/data/companyContact";
import { pricingTiers } from "@/data/pricing";
import { V8ContactFooter } from "@/pages/versions/v8/sections/16-contact-footer";
import { V8Faq } from "@/pages/versions/v8/sections/14-faq";

type Area = {
  key: string;
  label: string;
  title: string;
  lines: string[];
  href: string;
};

const areas: Area[] = [
  {
    key: "assess",
    label: "Cyber Risk Assessment",
    title: "What we review first",
    lines: ["Identity and sign-in", "Endpoints and patching", "Email security", "Backups and recovery", "Foundational security controls"],
    href: "/book",
  },
  {
    key: "it",
    label: "Managed IT",
    title: "Day-to-day IT, handled",
    lines: ["Help desk and ticket triage", "Endpoint management", "Network and Wi-Fi support", "Monthly reviews with your team"],
    href: "/solutions/managed-it-support",
  },
  {
    key: "backup",
    label: "Backup & recovery",
    title: "Recovery you can test",
    lines: ["Backup coverage review", "Offsite copies", "Restore testing", "Recovery planning with your team"],
    href: "/solutions/backup-disaster-recovery",
  },
  {
    key: "compliance",
    label: "Compliance",
    title: "Controls you can show",
    lines: ["Policy and access reviews", "Staff security training", "Evidence for audits", "Industry-specific requirements"],
    href: "/about/compliance",
  },
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

const industries = [
  { label: "Healthcare", href: "/industries/healthcare" },
  { label: "Accounting & finance", href: "/industries/accounting-finance" },
  { label: "Law firms", href: "/industries/law-firms" },
  { label: "Real estate", href: "/industries/real-estate" },
  { label: "Nonprofits", href: "/industries/nonprofits" },
  { label: "Animal hospitals", href: "/industries/animal-hospitals" },
];

function HeroArt(): JSX.Element {
  return (
    <div className="hm-art" aria-hidden="true">
      <svg className="hm-art__mark" data-depth="0.4" viewBox="0 0 200 200" role="presentation" focusable="false">
        <rect x="30" y="58" width="140" height="18" rx="9" fill="#d3126a" />
        <rect x="30" y="91" width="108" height="18" rx="9" fill="#d3126a" opacity="0.7" />
        <rect x="30" y="124" width="76" height="18" rx="9" fill="#d3126a" opacity="0.4" />
      </svg>
    </div>
  );
}

function useDepthParallax(rootRef: RefObject<HTMLElement>): void {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const layers = Array.from(root.querySelectorAll<HTMLElement>("[data-depth]"));
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = root.getBoundingClientRect();
      const progress = Math.min(Math.max(-rect.top / (rect.height || 1), -1), 1);
      for (const el of layers) {
        const depth = Number(el.dataset.depth) || 0;
        el.style.transform = `translate3d(0, ${(progress * depth * -120).toFixed(1)}px, 0)`;
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
  }, [rootRef]);
}

export function HomeMonday(): JSX.Element {
  const [active, setActive] = useState(areas[0].key);
  const current = areas.find((a) => a.key === active) ?? areas[0];
  const [step, setStep] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);

  useDepthParallax(rootRef);

  useEffect(() => {
    const items = stepRefs.current.filter((n): n is HTMLLIElement => n !== null);
    if (!("IntersectionObserver" in window) || items.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setStep(items.indexOf(entry.target as HTMLLIElement));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    items.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, []);

  useSEO({
    title: "Concept: product-led homepage",
    description: "Review concept. Not the live homepage.",
    canonical: "/",
    noIndex: true,
  });

  return (
    <div className="v8 hm min-h-screen text-[#1a1228]" ref={rootRef}>
      <OrganizationJsonLd />
      <WebSiteJsonLd />
      <MegaMenu />
      <SiteBottomBar autohide />
      <main id="home-main" className="contents">
        <section className="hm-hero" aria-labelledby="hm-hero-title">
          <div className="hm-wrap hm-hero__grid">
            <div className="hm-hero__copy">
              <h1 id="hm-hero-title" className="hm-h1">
                <span className="whitespace-nowrap">Cybersecurity-first</span> IT for Arizona businesses.
              </h1>
              <p className="hm-lede">
                Managed IT, security and compliance for businesses that can&rsquo;t afford downtime. Every
                engagement starts with a Cyber Risk Assessment, so the plan fits how your business runs.
              </p>
              <div className="hm-actions">
                <Link href="/book" className="hm-btn hm-btn--primary" data-testid="button-hero-assessment">
                  Get a Cyber Risk Assessment <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link href="/proactive-ecosystem-pricing" className="hm-btn hm-btn--ghost" data-testid="button-hero-plans">
                  See plans
                </Link>
              </div>
              <p className="hm-note">
                Prefer to talk?{" "}
                <a href={PRIMARY_PHONE.telHref} className="hm-link" data-testid="link-hero-phone">
                  Call {PRIMARY_PHONE.display}
                </a>
              </p>
            </div>

            <div className="hm-stage">
              <HeroArt />
              <div className="hm-tabs" role="tablist" aria-label="What we do">
                {areas.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    role="tab"
                    aria-selected={a.key === active}
                    aria-controls="hm-panel"
                    className="hm-tab"
                    onClick={() => setActive(a.key)}
                  >
                    {a.label}
                  </button>
                ))}
              </div>

              <div className="hm-window" id="hm-panel" role="tabpanel" aria-live="polite">
                <div className="hm-window__bar" aria-hidden="true">
                  <span /><span /><span />
                  <em>Example view, not a client report</em>
                </div>
                <div className="hm-window__body">
                  <span className="hm-cursor" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 2l15 9-6.5 1.6L9.6 20 4 2z" fill="#1a1228" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                  </span>
                  <h2 className="hm-window__title">{current.title}</h2>
                  <ul className="hm-window__list">
                    {current.lines.map((line) => (
                      <li key={line}>
                        <Check className="h-4 w-4" aria-hidden="true" />
                        {line}
                      </li>
                    ))}
                  </ul>
                  <Link href={current.href} className="hm-link">
                    Learn more about {current.label.toLowerCase()} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>

              <figure className="hm-founder">
                <img
                  src="/images/founder/joe-petro-studio-blazer-white.jpg"
                  alt="Joseph Petro, Founder of Digerati Experts"
                  width={96}
                  height={96}
                />
                <figcaption>
                  <span className="hm-founder__name">Joseph Petro</span>
                  <span className="hm-founder__role">Founder &amp; Chief Technology Strategist</span>
                </figcaption>
              </figure>
            </div>
          </div>
        </section>

        <section className="hm-band hm-panel-band" aria-labelledby="hm-steps-title">
          <div className="hm-wrap">
            <div className="hm-story">
              <div className="hm-story__pin" aria-hidden="true">
                <span className="hm-story__count">
                  {String(step + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}
                </span>
                <span className="hm-story__word">{steps[step].title}</span>
                <div className="hm-story__track">
                  {steps.map((s, i) => (
                    <span key={s.title} className={i <= step ? "is-on" : undefined} />
                  ))}
                </div>
              </div>
              <div className="hm-story__steps">
                <header className="hm-head hm-head--left">
                  <h2 id="hm-steps-title" className="hm-h2">Four steps, one plan you can follow.</h2>
                </header>
                <ol className="hm-steps">
                  {steps.map((s, i) => (
                    <li
                      key={s.title}
                      ref={(el) => {
                        stepRefs.current[i] = el;
                      }}
                      className={`hm-card hm-step${i === step ? " is-active" : ""}`}
                    >
                      <span className="hm-step__n">{i + 1}</span>
                      <h3 className="hm-h3">{s.title}</h3>
                      <p className="hm-body">{s.body}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>

        <section className="hm-band" aria-labelledby="hm-plans-title">
          <div className="hm-wrap">
            <header className="hm-head">
              <h2 id="hm-plans-title" className="hm-h2">Four operating models. One matched to your environment.</h2>
            </header>
            <div className="hm-plans">
              {pricingTiers.map((tier) => (
                <article key={tier.label} className="hm-card hm-plan">
                  <h3 className="hm-h3">{tier.label}</h3>
                  <ul className="hm-plan__list">
                    {(highlights[tier.name.toLowerCase()] ?? []).map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            <div className="hm-center">
              <Link href="/proactive-ecosystem-pricing" className="hm-link">
                Compare the plans <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <section className="hm-band hm-panel-band" aria-labelledby="hm-industries-title">
          <div className="hm-wrap">
            <header className="hm-head">
              <h2 id="hm-industries-title" className="hm-h2">Serving Arizona professional services, healthcare and growing SMBs.</h2>
            </header>
            <ul className="hm-chips">
              {industries.map((i) => (
                <li key={i.href}>
                  <Link href={i.href} className="hm-chip">{i.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="hm-band" aria-labelledby="hm-faq-title">
          <div className="hm-wrap">
            <div className="hm-faq-card">
              <div className="v8s-14"><V8Faq /></div>
            </div>
          </div>
        </section>

        <section className="hm-band hm-close" aria-labelledby="hm-close-title">
          <div className="hm-wrap hm-close__inner">
            <h2 id="hm-close-title" className="hm-h2 hm-h2--center">Start with a Cyber Risk Assessment.</h2>
            <p className="hm-body hm-center-text">Tell us about your environment. We&rsquo;ll follow up on the assessment, no hard sell.</p>
            <div className="hm-actions hm-actions--center">
              <Link href="/book" className="hm-btn hm-btn--primary">
                Get a Cyber Risk Assessment <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a href={PRIMARY_PHONE.telHref} className="hm-btn hm-btn--ghost-dark">Call {PRIMARY_PHONE.display}</a>
            </div>
            <nav className="hm-also" aria-label="More on the site">
              <Link href="/resources" className="hm-link-dark">Threats &amp; insights</Link>
              <Link href="/about/guarantee" className="hm-link-dark">Guarantee</Link>
              <Link href="/about/compliance" className="hm-link-dark">Compliance</Link>
              <Link href="/about/team" className="hm-link-dark">Team</Link>
            </nav>
          </div>
        </section>

        <div className="v8s-16"><V8ContactFooter /></div>
      </main>
    </div>
  );
}
