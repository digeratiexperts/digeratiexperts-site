// Concept v2 (Exploration Mode, 2026-10-18): light-first, product-led homepage at /concepts/home-monday.
// Structural cues from monday.com (light canvas, product window hero, pill use-case tabs, soft panels).
// Identity kept: DE palette, real founder photo, no invented logos, metrics or illustrated characters.
// Not the production homepage. The live / is HomepageV8.
import "../versions/v8/v8.css";
import "../versions/v8/v8-dashboard.css";
import "./home-monday.css";
import { useState } from "react";
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

export function HomeMonday(): JSX.Element {
  const [active, setActive] = useState(areas[0].key);
  const current = areas.find((a) => a.key === active) ?? areas[0];

  useSEO({
    title: "Concept: product-led homepage",
    description: "Review concept. Not the live homepage.",
    canonical: "/",
    noIndex: true,
  });

  return (
    <div className="v8 hm min-h-screen text-[#1a1228]">
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
            <header className="hm-head">
              <h2 id="hm-steps-title" className="hm-h2">Four steps, one plan you can follow.</h2>
            </header>
            <ol className="hm-steps">
              {steps.map((s, i) => (
                <li key={s.title} className="hm-card hm-step">
                  <span className="hm-step__n">{i + 1}</span>
                  <h3 className="hm-h3">{s.title}</h3>
                  <p className="hm-body">{s.body}</p>
                </li>
              ))}
            </ol>
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
