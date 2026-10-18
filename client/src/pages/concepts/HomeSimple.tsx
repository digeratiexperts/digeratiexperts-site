// Concept (Exploration Mode, 2026-10-18): a simpler homepage story at /concepts/home-simple.
// Not the production homepage. The live / is HomepageV8 and stays unchanged until Joe picks.
// One dark field throughout; light content only in rounded paper cards (no full-bleed paper bands).
import "../versions/v8/v8.css";
import "../versions/v8/v8-dashboard.css";
import "./home-simple.css";
import { Link } from "wouter";
import { ArrowRight, ClipboardCheck, Route, Wrench, ShieldCheck, Check } from "lucide-react";
import { MegaMenu } from "@/components/MegaMenu";
import { SiteBottomBar } from "@/components/SiteBottomBar";
import { useSEO } from "@/hooks/useSEO";
import { OrganizationJsonLd, WebSiteJsonLd } from "@/components/JsonLd";
import { PRIMARY_PHONE } from "@/data/companyContact";
import { pricingTiers } from "@/data/pricing";
import { V8ContactFooter } from "@/pages/versions/v8/sections/16-contact-footer";
import { V8Faq } from "@/pages/versions/v8/sections/14-faq";

const steps = [
  { icon: ClipboardCheck, title: "Assess", body: "We review identity, endpoints, email, backups and foundational security controls." },
  { icon: Route, title: "Roadmap", body: "A prioritized plan sized to your environment, not a generic package." },
  { icon: Wrench, title: "Implement", body: "We make the fixes that reduce the most risk first, in an order you can follow." },
  { icon: ShieldCheck, title: "Keep it running", body: "Ongoing management and regular strategy reviews, so the gains hold." },
];

const assessmentReviews = ["Identity", "Endpoints", "Email", "Backups", "Foundational security controls"];

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

export function HomeSimple(): JSX.Element {
  useSEO({
    title: "Concept: simpler homepage",
    description: "Review concept. Not the live homepage.",
    canonical: "/",
    noIndex: true,
  });

  return (
    <div className="v8 hs min-h-screen bg-[#050312] text-white">
      <OrganizationJsonLd />
      <WebSiteJsonLd />
      <MegaMenu />
      <SiteBottomBar autohide />
      <main id="home-main" className="contents">
        <section className="hs-hero" aria-labelledby="hs-hero-title">
          <div className="hs-wrap hs-hero__inner">
            <p className="hs-pill">Arizona managed IT and cybersecurity</p>
            <h1 id="hs-hero-title" className="hs-h1">
              <span className="whitespace-nowrap">Cybersecurity-first</span> IT for Arizona businesses.
            </h1>
            <p className="hs-lede">
              Managed IT, security and compliance for businesses that can&rsquo;t afford downtime. Every
              engagement starts with a Cyber Risk Assessment, so the plan fits how your business runs.
            </p>
            <div className="hs-actions">
              <Link href="/book" className="hs-btn hs-btn--primary" data-testid="button-hero-assessment">
                Get a Cyber Risk Assessment <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/proactive-ecosystem-pricing" className="hs-btn hs-btn--ghost" data-testid="button-hero-plans">
                See plans
              </Link>
            </div>
            <p className="hs-phone">
              Prefer to talk?{" "}
              <a href={PRIMARY_PHONE.telHref} className="hs-link" data-testid="link-hero-phone">
                Call {PRIMARY_PHONE.display}
              </a>
            </p>
          </div>
          <figure className="hs-wrap hs-hero__figure">
            <img
              src="/images/founder/joe-petro-studio-blazer-white.jpg"
              alt="Joseph Petro, Founder of Digerati Experts"
              className="hs-hero__photo"
              width={900}
              height={1100}
              fetchPriority="high"
            />
            <figcaption className="hs-hero__caption">
              <span className="hs-hero__name">Joseph Petro</span>
              <span className="hs-hero__role">Founder &amp; Chief Technology Strategist</span>
            </figcaption>
          </figure>
        </section>

        <section className="hs-band" aria-labelledby="hs-steps-title">
          <div className="hs-wrap">
            <header className="hs-head">
              <h2 id="hs-steps-title" className="hs-h2">Four steps, one plan you can follow.</h2>
            </header>
            <ol className="hs-steps">
              {steps.map((s) => (
                <li key={s.title} className="hs-card hs-step">
                  <span className="hs-iconwell" aria-hidden="true"><s.icon className="h-5 w-5" /></span>
                  <h3 className="hs-h3">{s.title}</h3>
                  <p className="hs-body">{s.body}</p>
                </li>
              ))}
            </ol>
            <div className="hs-review">
              <div className="hs-review__copy">
                <h3 className="hs-h3">What the assessment reviews</h3>
                <p className="hs-body">
                  A clear view of where you stand before anything is changed. The roadmap comes from this,
                  not from a template.
                </p>
              </div>
              <ul className="hs-review__card" aria-label="Assessment areas">
                {assessmentReviews.map((item) => (
                  <li key={item} className="hs-review__item">
                    <Check className="h-4 w-4" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="hs-band" aria-labelledby="hs-plans-title">
          <div className="hs-wrap">
            <header className="hs-head">
              <h2 id="hs-plans-title" className="hs-h2">Four operating models. One matched to your environment.</h2>
            </header>
            <div className="hs-plans">
              {pricingTiers.map((tier) => (
                <article key={tier.label} className="hs-card hs-plan">
                  <h3 className="hs-h3">{tier.label}</h3>
                  <ul className="hs-plan__list">
                    {(highlights[tier.name.toLowerCase()] ?? []).map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            <div className="hs-center">
              <Link href="/proactive-ecosystem-pricing" className="hs-link hs-link--big">
                Compare the plans <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <section className="hs-band hs-statement" aria-labelledby="hs-lead-title">
          <div className="hs-wrap hs-statement__inner">
            <h2 id="hs-lead-title" className="hs-statement__text">
              Assessments and roadmaps are led by the founder, sized to how your business runs.
            </h2>
            <Link href="/about/team" className="hs-link">Meet the team</Link>
          </div>
        </section>

        <section className="hs-band" aria-labelledby="hs-industries-title">
          <div className="hs-wrap">
            <header className="hs-head">
              <h2 id="hs-industries-title" className="hs-h2">Serving Arizona professional services, healthcare and growing SMBs.</h2>
            </header>
            <ul className="hs-chips">
              {industries.map((i) => (
                <li key={i.href}>
                  <Link href={i.href} className="hs-chip">{i.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="hs-band" aria-labelledby="hs-faq-title">
          <div className="hs-wrap">
            <div className="hs-paper-card">
              <div className="v8s-14"><V8Faq /></div>
            </div>
          </div>
        </section>

        <section className="hs-band hs-close" aria-labelledby="hs-close-title">
          <div className="hs-wrap hs-close__inner">
            <h2 id="hs-close-title" className="hs-h2 hs-h2--center">Start with a Cyber Risk Assessment.</h2>
            <p className="hs-body hs-center-text">Tell us about your environment. We&rsquo;ll follow up on the assessment, no hard sell.</p>
            <div className="hs-actions hs-actions--center">
              <Link href="/book" className="hs-btn hs-btn--primary">
                Get a Cyber Risk Assessment <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a href={PRIMARY_PHONE.telHref} className="hs-btn hs-btn--ghost">Call {PRIMARY_PHONE.display}</a>
            </div>
            <nav className="hs-also" aria-label="More on the site">
              <Link href="/resources" className="hs-link">Threats &amp; insights</Link>
              <Link href="/about/guarantee" className="hs-link">Guarantee</Link>
              <Link href="/about/compliance" className="hs-link">Compliance</Link>
              <Link href="/about/team" className="hs-link">Team</Link>
            </nav>
          </div>
        </section>

        <div className="v8s-16"><V8ContactFooter /></div>
      </main>
    </div>
  );
}
