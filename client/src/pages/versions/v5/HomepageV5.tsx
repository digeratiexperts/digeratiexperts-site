import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useSEO } from "@/hooks/useSEO";
import { DE_LOGO_PRIMARY, DE_MARK } from "@/lib/brandAssets";
import { COMPANY, COMPANY_SOCIAL, PRIMARY_PHONE, formatAddressOneLine } from "@/data/companyContact";
import { pricingTiers, pricing, formatPrice, NO_BLACK_BOX_TAGLINE, PRICING_SCOPE_NOTE } from "@/data/pricing";
import "./v5.css";

/**
 * Digerati Experts homepage, Version 5: the practical one.
 *
 * Joe, 2026-09-30: "exactly start over, make something better. dont make these
 * mistakes. make a way to know you will be successful and not fail."
 *
 * One conventional page on a light ground with the real gold mark. It says what
 * DE does, for whom, what it costs and who to call, above the fold, and then
 * answers the questions a buyer has before picking up the phone. Nothing here
 * is invented: prices come from client/src/data/pricing.ts, contact details from
 * shared/companyContact.ts, response times from the SLA page, the photograph is
 * the founder's approved one, the FAQ is the published one. No animation, no
 * scroll effects, no generated imagery. ACCEPTANCE.md beside this file lists the
 * checks that scripts/qa/homepage-v5-acceptance.mjs runs before anyone sees it.
 */

const BOOK = "/book";
const ACTION = "Book a Cyber Risk Assessment";
const FOUNDER_JPG = "/images/founder/joe-petro-studio-blazer-white.jpg";
const FOUNDER_WEBP = "/images/founder/joe-petro-studio-blazer-white.webp";

const NAV = [
  { href: "/solutions", label: "Services" },
  { href: "/pricing", label: "Pricing" },
  { href: "/industries", label: "Industries" },
  { href: "/about/team", label: "About" },
  { href: "/contact", label: "Contact" },
];

const SERVICES = [
  {
    title: "Managed IT support",
    href: "/solutions/managed-it-support",
    body: "A help desk that owns your issue until it is fixed, keeps devices patched, and documents how your environment is built.",
  },
  {
    title: "Cybersecurity, watched around the clock",
    href: "/solutions/threat-detection",
    body: "24/7 managed detection and response across your devices, accounts and email, plus phishing training so your staff become a defence rather than a risk.",
  },
  {
    title: "Backup and disaster recovery",
    href: "/solutions/backup-disaster-recovery",
    body: "Backups that are tested, with recovery targets agreed before you ever need them.",
  },
  {
    title: "Network and workplace",
    href: "/solutions/managed-workplace",
    body: "Managed network and connectivity, and the day-to-day tools your team works in, kept running and kept current.",
  },
  {
    title: "Co-managed IT",
    href: "/solutions/co-managed-it",
    body: "Already have an IT person? We add the security operations, the tooling and the after-hours coverage, and they keep the relationship.",
  },
  {
    title: "Compliance and risk reporting",
    href: "/solutions/compliance-reports",
    body: "Audit-grade reporting for HIPAA, PCI DSS, SOC 2 and cyber-insurance reviews. Those are your requirements, not our certifications.",
  },
];

/** The eight blocks the live homepage's protection command deck lists. */
const COVERAGE = [
  "Identity & Access",
  "Endpoint",
  "Email & Collaboration",
  "Browser & Web",
  "Network",
  "Detection & Response",
  "Human Risk",
  "Risk & Exposure",
];

const INDUSTRIES = [
  { href: "/industries/healthcare", label: "Healthcare" },
  { href: "/industries/law-firms", label: "Law firms" },
  { href: "/industries/accounting-finance", label: "Accounting and finance" },
  { href: "/industries/real-estate", label: "Real estate" },
  { href: "/industries/nonprofits", label: "Nonprofits" },
  { href: "/industries/animal-hospitals", label: "Veterinary practices" },
  { href: "/industries", label: "All industries" },
];

const STEPS = [
  {
    title: "Cyber Risk Assessment",
    body: "We look at identity, endpoints, email, backups and how your business actually operates before recommending anything.",
  },
  {
    title: "A written recommendation",
    body: "Which of the four ProActive models fits, and why. User count is a signal, never the sole criterion.",
  },
  {
    title: "Onboarding",
    body: "Your environment documented, the security baseline in place, monitoring and the help desk live.",
  },
  {
    title: "Ongoing operations",
    body: "Reviews at your plan's cadence: annual for Office, semi-annual for Business, quarterly executive reviews for Enterprise.",
  },
];

const SLA_ROWS = [
  { severity: "Critical", meaning: "Active breach or system down", response: "15 minutes" },
  { severity: "High", meaning: "Major functionality impaired", response: "1 hour" },
  { severity: "Medium", meaning: "Partial loss", response: "4 hours" },
  { severity: "Low", meaning: "Questions and minor issues", response: "Next business day" },
];

const PLEDGES = [
  {
    title: "30-day money-back guarantee",
    body: "No questions asked, on managed IT and cybersecurity services.",
    href: "/about/guarantee",
    link: "Read the guarantee",
  },
  {
    title: "Client Bill of Rights",
    body: "Complete satisfaction, compliance-first solutions, plain-English communication, professionalism and respect.",
    href: "/about/client-bill-of-rights",
    link: "Read the Bill of Rights",
  },
  {
    title: "21 questions to ask any IT company",
    body: "Bring them to every provider you talk to, including us.",
    href: "/about/21-questions",
    link: "Get the questions",
  },
];

/** Verbatim from the published homepage FAQ (DigeratiFAQSection). */
const FAQ = [
  {
    q: "What is your best service?",
    a: "There isn’t a universally “best” package. ProActive is four operating models — IT, Office, Business, and Enterprise — matched to users, devices, locations, infrastructure, security, compliance, and whether you need fully or co-managed coverage. If Office would need heavy modification, Business is the correct fit for that environment, not a higher rank.",
  },
  {
    q: "How do I choose the right plan for my business?",
    a: "User count is a signal, never the sole criterion. We start with a Cyber Risk Assessment of your environment, then match IT, Office, Business, or Enterprise. We do not start with a package and pile on add-ons.",
  },
  {
    q: "Can I customize the solutions?",
    a: "Yes! We understand every business is unique. Our packages can be customized with additional services, and we offer both co-managed and fully managed options to fit your existing IT structure.",
  },
  {
    q: "Is my data secure?",
    a: "Yes. We use enterprise-grade controls, 24/7 monitoring, and documented security protocols. We help Arizona businesses prepare for HIPAA, PCI DSS, SOC 2, and cyber-insurance reviews — with clear ownership of credentials, policies, and evidence.",
  },
];

type Review = { id: string; authorName: string; rating: number; text: string; sourceLabel?: string; url?: string };

/** Real reviews only, from the live feed. The section is absent when the feed is empty. */
function useReviews(): Review[] {
  const [reviews, setReviews] = useState<Review[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/public/reviews", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { reviews?: Review[] } | null) => {
        const list = (data?.reviews ?? []).filter((r) => r.rating >= 4 && r.text?.trim());
        setReviews(list.slice(0, 3));
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return reviews;
}

function PrimaryAction({ className = "" }: { className?: string }) {
  return (
    <Link href={BOOK} className={`v5-btn v5-btn-primary ${className}`} data-v5-cta="primary" data-testid="v5-primary-action">
      {ACTION}
    </Link>
  );
}

export default function HomepageV5(): JSX.Element {
  useSEO({
    title: "Managed IT and Cybersecurity for Arizona Businesses",
    description:
      "Arizona MSP/MSSP. Cybersecurity-first managed IT, 24/7 emergency incident response, and a Cyber Risk Assessment that matches the operating model to your environment.",
  });

  // The site's shell is dark; this page is light to its edges, including the
  // overscroll area on a phone.
  useEffect(() => {
    const root = document.documentElement;
    const prev = { root: root.style.backgroundColor, body: document.body.style.backgroundColor };
    root.style.backgroundColor = "#ffffff";
    document.body.style.backgroundColor = "#ffffff";
    return () => {
      root.style.backgroundColor = prev.root;
      document.body.style.backgroundColor = prev.body;
    };
  }, []);

  const reviews = useReviews();
  const year = new Date().getFullYear();

  return (
    <div className="v5" data-testid="homepage-v5">
      <header className="v5-header">
        <div className="v5-wrap v5-header-inner">
          <Link href="/" className="v5-logo" aria-label="Digerati Experts home">
            <img src={DE_LOGO_PRIMARY} alt="Digerati Experts" width="180" height="34" />
          </Link>
          <nav className="v5-nav" aria-label="Main">
            <ul>
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="v5-header-actions">
            <a className="v5-phone" href={PRIMARY_PHONE.telHref}>
              {PRIMARY_PHONE.display}
            </a>
            <PrimaryAction />
            <details className="v5-menu">
              <summary aria-label="Open menu">Menu</summary>
              <div className="v5-menu-panel">
                {NAV.map((item) => (
                  <Link key={item.href} href={item.href}>
                    {item.label}
                  </Link>
                ))}
                <a href={PRIMARY_PHONE.telHref}>Call {PRIMARY_PHONE.display}</a>
              </div>
            </details>
          </div>
        </div>
      </header>

      <main id="v5-main">
        <section className="v5-hero" aria-labelledby="v5-h1">
          <div className="v5-wrap v5-hero-grid">
            <div className="v5-hero-copy">
              <p className="v5-eyebrow">
                {COMPANY.addressLocality}, {COMPANY.addressRegion === "AZ" ? "Arizona" : COMPANY.addressRegion} · Managed IT and cybersecurity
              </p>
              <h1 id="v5-h1">Managed IT and cybersecurity for Arizona businesses.</h1>
              <p className="v5-lede">
                Digerati Experts runs and protects your company's technology: the help desk, security monitoring, backups and the
                network, from one accountable team, with published prices and a written SLA.
              </p>
              <div className="v5-actions">
                <PrimaryAction />
                <a className="v5-btn v5-btn-secondary" href={PRIMARY_PHONE.telHref}>
                  Call {PRIMARY_PHONE.display}
                </a>
              </div>
              <ul className="v5-facts" aria-label="Three facts">
                <li className="v5-fact">
                  <strong className="v5-num">From {formatPrice(pricing.it.user)} per user a month</strong>
                  <span className="v5-num">{formatPrice(pricing.it.monthlyMinimum)} monthly minimum. Four plans, all priced on the pricing page.</span>
                </li>
                <li className="v5-fact">
                  <strong>15 minutes to a critical issue</strong>
                  <span>Response times are written into our SLA, with service credits if we miss them.</span>
                </li>
                <li className="v5-fact">
                  <strong>24/7/365 emergency response</strong>
                  <span>Emergency incident response availability, around the clock, all year.</span>
                </li>
              </ul>
            </div>
            <figure className="v5-hero-figure">
              <picture>
                <source srcSet={FOUNDER_WEBP} type="image/webp" />
                <img src={FOUNDER_JPG} alt="Joseph Petro, founder of Digerati Experts" width="768" height="1024" loading="eager" decoding="async" />
              </picture>
              <figcaption>
                Joseph Petro, founder. Principal-led: accountable recommendations from the people who stand behind the work.
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="v5-section" aria-labelledby="v5-services">
          <div className="v5-wrap">
            <div className="v5-head">
              <p className="v5-eyebrow">What we do</p>
              <h2 id="v5-services">Everything your business needs from IT, under one roof.</h2>
              <p className="v5-lede">Plain words for what each service does for you. Each one links to the detail.</p>
            </div>
            <ul className="v5-cards">
              {SERVICES.map((s) => (
                <li key={s.href} className="v5-card">
                  <h3>
                    <Link href={s.href}>{s.title}</Link>
                  </h3>
                  <p>{s.body}</p>
                  <Link href={s.href} className="v5-more" aria-label={`${s.title}: read more`}>
                    Read more
                  </Link>
                </li>
              ))}
            </ul>
            <div className="v5-strip">
              <p className="v5-muted">What the security work covers</p>
              <ul aria-label="The eight areas the security work covers">
                {COVERAGE.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="v5-section v5-alt" aria-labelledby="v5-who">
          <div className="v5-wrap">
            <div className="v5-head">
              <p className="v5-eyebrow">Who we work with</p>
              <h2 id="v5-who">Small and mid-sized organizations across Greater Phoenix.</h2>
              <p className="v5-lede">
                Chandler, Phoenix, Scottsdale, Tempe, Mesa and Gilbert. If your business holds other people's sensitive information
                and answers to someone about it, this is built for you.
              </p>
            </div>
            <div className="v5-chips">
              {INDUSTRIES.map((i) => (
                <Link key={i.href} href={i.href}>
                  {i.label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="v5-section" aria-labelledby="v5-how">
          <div className="v5-wrap">
            <div className="v5-head">
              <p className="v5-eyebrow">How it works</p>
              <h2 id="v5-how">We start by looking, not by selling a package.</h2>
            </div>
            <ol className="v5-steps">
              {STEPS.map((s) => (
                <li key={s.title} className="v5-step">
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </li>
              ))}
            </ol>
            <div className="v5-actions" style={{ marginTop: 28 }}>
              <PrimaryAction />
            </div>
          </div>
        </section>

        <section className="v5-section v5-alt" aria-labelledby="v5-pricing">
          <div className="v5-wrap">
            <div className="v5-head">
              <p className="v5-eyebrow">Pricing</p>
              <h2 id="v5-pricing">Four plans, priced in the open.</h2>
              <p className="v5-lede">{NO_BLACK_BOX_TAGLINE}</p>
            </div>
            <ul className="v5-tiers">
              {pricingTiers.map((t) => (
                <li key={t.id} className="v5-tier">
                  <p className="v5-tier-badge">{t.tier}</p>
                  <h3>{t.label}</h3>
                  <p className="v5-price v5-num">
                    {formatPrice(t.user)} <small>per user / month</small>
                  </p>
                  <p className="v5-muted v5-num">{formatPrice(t.monthlyMinimum)} monthly minimum</p>
                  <p>{t.idealBuyer}</p>
                  <ul aria-label={`${t.label} includes`}>
                    {t.inclusions.slice(0, 3).map((inc) => (
                      <li key={inc}>{inc}</li>
                    ))}
                  </ul>
                  <Link href={t.learnMoreUrl} className="v5-more">
                    See what's included
                  </Link>
                </li>
              ))}
            </ul>
            <p className="v5-note">
              {PRICING_SCOPE_NOTE} <Link href="/pricing">Full pricing page</Link>.
            </p>
          </div>
        </section>

        <section className="v5-section" aria-labelledby="v5-sla">
          <div className="v5-wrap v5-two">
            <div>
              <div className="v5-head">
                <p className="v5-eyebrow">Response times</p>
                <h2 id="v5-sla">Response times, in writing.</h2>
                <p className="v5-lede">Published in our Service Level Agreement, with service credits if we miss them.</p>
              </div>
              <table className="v5-table">
                <thead>
                  <tr>
                    <th scope="col">Severity</th>
                    <th scope="col">What it means</th>
                    <th scope="col">Response</th>
                  </tr>
                </thead>
                <tbody>
                  {SLA_ROWS.map((r) => (
                    <tr key={r.severity}>
                      <td>{r.severity}</td>
                      <td>{r.meaning}</td>
                      <td className="v5-num">{r.response}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="v5-note">
                24/7/365 emergency incident response availability. <Link href="/legal/sla">Read the SLA</Link>.
              </p>
            </div>
            <div className="v5-pledges">
              <h3>What else we put in writing</h3>
              {PLEDGES.map((p) => (
                <div key={p.href} className="v5-pledge">
                  <h3>{p.title}</h3>
                  <p>{p.body}</p>
                  <Link href={p.href} className="v5-more">
                    {p.link}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {reviews.length > 0 && (
          <section className="v5-section v5-alt" aria-labelledby="v5-reviews">
            <div className="v5-wrap">
              <div className="v5-head">
                <p className="v5-eyebrow">Reviews</p>
                <h2 id="v5-reviews">What clients say.</h2>
              </div>
              <ul className="v5-reviews">
                {reviews.map((r) => (
                  <li key={r.id} className="v5-review">
                    <p className="v5-stars" aria-label={`${r.rating} out of 5`}>
                      {r.rating}/5{r.sourceLabel ? ` · ${r.sourceLabel}` : ""}
                    </p>
                    <blockquote>{r.text}</blockquote>
                    <cite>{r.authorName}</cite>
                  </li>
                ))}
              </ul>
              <p className="v5-note">
                <a href={COMPANY.mapsUrl} rel="noopener noreferrer" target="_blank">
                  Read all reviews on Google
                </a>
              </p>
            </div>
          </section>
        )}

        <section className="v5-section" aria-labelledby="v5-faq">
          <div className="v5-wrap">
            <div className="v5-head">
              <p className="v5-eyebrow">Questions</p>
              <h2 id="v5-faq">Questions people ask before they call.</h2>
            </div>
            <div className="v5-faq">
              {FAQ.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="v5-section v5-alt" aria-labelledby="v5-contact">
          <div className="v5-wrap v5-contact">
            <div>
              <div className="v5-head">
                <p className="v5-eyebrow">Contact</p>
                <h2 id="v5-contact">Talk to a person in Chandler.</h2>
                <p className="v5-lede">Book the assessment, or call or write and tell us what is going on.</p>
              </div>
              <div className="v5-actions">
                <PrimaryAction />
                <a className="v5-btn v5-btn-secondary" href={`mailto:${COMPANY.email}`}>
                  Email us
                </a>
              </div>
            </div>
            <dl>
              <div>
                <dt>Phone</dt>
                <dd>
                  <a href={PRIMARY_PHONE.telHref}>{PRIMARY_PHONE.display}</a>
                </dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>
                  <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
                </dd>
              </div>
              <div>
                <dt>Office</dt>
                <dd>
                  {formatAddressOneLine()}
                  <br />
                  <a href={COMPANY.mapsUrl} rel="noopener noreferrer" target="_blank">
                    Directions
                  </a>
                </dd>
              </div>
              <div>
                <dt>Service area</dt>
                <dd>{COMPANY.areaServed}</dd>
              </div>
            </dl>
          </div>
        </section>
      </main>

      <footer className="v5-footer">
        <div className="v5-wrap v5-footer-grid">
          <p style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src={DE_MARK} alt="" width="28" height="28" aria-hidden="true" />
            <span>
              © {year} {COMPANY.legalName}. {formatAddressOneLine()}.
            </span>
          </p>
          <ul aria-label="Legal and social">
            <li>
              <Link href="/pricing">Pricing</Link>
            </li>
            <li>
              <Link href="/legal/sla">Service Level Agreement</Link>
            </li>
            <li>
              <Link href="/legal/terms-of-use">Terms of Use</Link>
            </li>
            <li>
              <Link href="/legal/privacy-policy">Privacy Policy</Link>
            </li>
            {Object.values(COMPANY_SOCIAL).map((s) => (
              <li key={s.href}>
                <a href={s.href} rel="noopener noreferrer" target="_blank">
                  {s.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </footer>
    </div>
  );
}
