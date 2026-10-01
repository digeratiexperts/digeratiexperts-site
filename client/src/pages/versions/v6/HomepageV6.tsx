import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "wouter";
import { useSEO } from "@/hooks/useSEO";
import { DE_LOGO_PRIMARY } from "@/lib/brandAssets";
import { COMPANY, COMPANY_SOCIAL, PRIMARY_PHONE, formatAddressOneLine } from "@/data/companyContact";
import { pricingTiers, pricing, formatPrice, PRICING_SCOPE_NOTE } from "@/data/pricing";
import { getHomepageCyberFacts } from "@/data/cyberAwarenessFacts";
import { protectionDomains } from "@/components/visual/ProtectionCommandDeck";
import { useThreatFeed } from "@/hooks/useThreatFeed";
import { THREAT_ATTRIBUTION } from "@shared/threatFeed";
import "./v6.css";

/**
 * Digerati Experts homepage, Version 6: every section of the live homepage,
 * redrawn on the Version 5 system.
 *
 * Joe, 2026-10-01: "can you mock up every section on the live
 * Digeratiexperts.com homepage and make it look how it should look", then
 * "continue". The eighteen mockups came first; this is the page they describe.
 *
 * Same order as the live page, section for section. Every fact is read from the
 * file that already carries it: prices from client/src/data/pricing.ts, the
 * four statistics from client/src/data/cyberAwarenessFacts.ts (each linked to
 * its report), the eight blocks from the live command deck's data, response
 * times from the SLA page, contact details from shared/companyContact.ts, the
 * FAQ verbatim, reviews and security updates from the live feeds only. No
 * generated or stock imagery: the founder's approved photograph and the brand
 * mark are the only images. One action everywhere. No animation.
 * ACCEPTANCE.md beside this file says how the page is checked.
 */

const BOOK = "/book";
const ACTION = "Book a Cyber Risk Assessment";
const FOUNDER_JPG = "/images/founder/joe-petro-studio-blazer-white.jpg";
const FOUNDER_WEBP = "/images/founder/joe-petro-studio-blazer-white.webp";

const NAV = [
  { href: "/solutions", label: "Solutions" },
  { href: "/industries", label: "Industries" },
  { href: "/resources", label: "Resources" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about/team", label: "About" },
  { href: "/store", label: "Store" },
  { href: "/contact", label: "Contact" },
];

/** The live alert banner's three items (DigeratiAlertBanner), in plain words. */
const WHY_WE_EXIST = [
  { title: "Security-first operations", body: "Every system, endpoint and user is protected by design, not by reaction." },
  { title: "Co-managed or fully managed", body: "We support your internal IT, or we serve as your outsourced technology team." },
  { title: "Executive-level transparency", body: "Reports, KPIs and compliance insights that make sense and drive decisions." },
];

/** The live "What We Tackle" six, each linking to the page that handles it. */
const TACKLE = [
  { title: "Ransomware and malware", body: "Advanced threat detection and rapid response to stop malicious activity before damage occurs.", href: "/solutions/threat-detection", link: "Threat detection" },
  { title: "Data loss", body: "Backup strategies with tested disaster recovery, so the business keeps running.", href: "/solutions/backup-disaster-recovery", link: "Backup and disaster recovery" },
  { title: "Compliance gaps", body: "HIPAA, PCI DSS and SOC 2 requirements with continuous monitoring and reporting.", href: "/solutions/compliance-reports", link: "Compliance reports" },
  { title: "Phishing and social engineering", body: "Layered email security combined with ongoing employee security awareness training.", href: "/solutions/security-operations", link: "Security operations" },
  { title: "Zero-day vulnerabilities", body: "Proactive patch management and security assessments that close gaps before exploitation.", href: "/solutions/threat-detection", link: "Threat detection" },
  { title: "Insider threats", body: "User behavior analytics and access controls that prevent internal security breaches.", href: "/solutions/unified-security", link: "Unified security" },
];

/** The live services section's three engagement paths. */
const PATHS = [
  { kicker: "ProActive Ecosystem", title: "Fully managed IT and cybersecurity", body: "One accountable team for support, identity, endpoints, email, backup and security operations.", href: "/solutions/proactive-ecosystem", link: "Explore managed services" },
  { kicker: "Keep your team", title: "Co-managed IT", body: "Add DE security operations, monitoring and specialized coverage to your internal IT without replacing it.", href: "/solutions/co-managed-it", link: "See co-managed" },
  { kicker: "Start here", title: "Cyber Risk Assessment", body: "A practical review of identity, endpoints, email, backups and security posture. Then choose what to own together.", href: BOOK, link: "Book a Cyber Risk Assessment" },
];

/** The live services section's six capabilities, with their pages. */
const CAPABILITIES = [
  { title: "SOC / MDR monitoring", body: "24/7 detection and response.", href: "/solutions/security-operations" },
  { title: "Endpoint security (EDR)", body: "Protect devices across the environment.", href: "/solutions/threat-detection" },
  { title: "SMART Identity (MFA + SSO)", body: "Stronger access without user chaos.", href: "/solutions/unified-security" },
  { title: "Privileged access controls", body: "Admin controls and audit visibility.", href: "/solutions/unified-security" },
  { title: "Backup and disaster recovery", body: "Recovery planning and restore discipline.", href: "/solutions/backup-disaster-recovery" },
  { title: "Email protection", body: "Anti-phishing and mailbox defenses.", href: "/solutions/security-operations" },
];

/** The live "How protection works" four steps (DigeratiHowWeProtectSection). */
const STEPS = [
  { title: "Assessment", body: "Review identity, endpoints, email, backups, network and operating reality." },
  { title: "Roadmap", body: "Match the operating model to the environment. Fit, not a ranking ladder." },
  { title: "Implementation", body: "Documented credentials you own. Controls sized to the model we matched." },
  { title: "Continuous", body: "Day-to-day support and the DE Security Foundation at every tier. Detection, response, recovery and governance deepen with the plan." },
];

/** The live testimonials section's three outcomes. */
const OUTCOMES = [
  { title: "Fewer vendors to manage", body: "One accountable team for IT support and security operations." },
  { title: "Clearer security visibility", body: "Identity, endpoint, email and backup posture you can actually explain." },
  { title: "Faster triage when something breaks", body: "Named ownership and documented standards, not ticket roulette." },
];

const PROOF = [
  { title: "Client Bill of Rights", body: "What you can expect from us, in writing.", href: "/about/client-bill-of-rights", link: "Read the Bill of Rights" },
  { title: "30-day guarantee", body: "100% money back. No risk, no small print, no questions asked.", href: "/about/guarantee", link: "Our guarantee" },
  { title: "Trust Center", body: "Security documentation and operating expectations in one place for diligence and cyber-insurance conversations.", href: "/trust/trust-center", link: "Open the Trust Center" },
  { title: "Case studies", body: "Real engagements with challenge, approach and outcome, published with client permission.", href: "/resources/case-studies", link: "View case studies" },
];

/** The live trust section's three pillars (DigeratiTrustPhotoSection). */
const PILLARS = [
  { title: "Arizona-based", body: "Local principal support for businesses that need a real person, not a ticket queue." },
  { title: "Principal-led", body: "Recommendations come from the people who will stand behind the work." },
  { title: "Sized to your business", body: "Controls and tooling matched to your risk, not an enterprise stack you will not use." },
];

/** Published in the Service Level Agreement (client/src/pages/legal/SLA.tsx). */
const SLA_ROWS = [
  { severity: "Critical", meaning: "Active breach or system down", response: "15 minutes" },
  { severity: "High", meaning: "Major functionality impaired", response: "1 hour" },
  { severity: "Medium", meaning: "Partial loss", response: "4 hours" },
  { severity: "Low", meaning: "Questions and minor issues", response: "Next business day" },
];

/** The live team section's three roles (DigeratiMeetExpertsSection). */
const ROLES = [
  { title: "Security operations", body: "Monitoring, detection and response ownership when threats appear." },
  { title: "Technical operations", body: "Day-to-day support, identity, endpoints and environment stability." },
  { title: "Client success", body: "QBRs, roadmaps and a named relationship, not a rotating ticket queue." },
];

/** The live industries section's five, with their pages. */
const INDUSTRIES = [
  { title: "Law firms", body: "Client privilege and ABA requirements.", href: "/industries/law-firms" },
  { title: "CPA firms", body: "Tax data security and IRS and FTC requirements.", href: "/industries/accounting-finance" },
  { title: "Medical practices", body: "HIPAA compliance and patient data protection.", href: "/industries/healthcare" },
  { title: "Real estate firms", body: "Wire fraud prevention and transaction security.", href: "/industries/real-estate" },
  { title: "Animal hospitals", body: "Veterinary practice and client data protection.", href: "/industries/animal-hospitals" },
];

/** The live detection section's four points (DigeratiAIAssistanceSection). */
const DETECTION_POINTS = [
  "Partner-backed detection and alerting across endpoints and identity",
  "Human triage: analysts decide what matters before you get a false alarm",
  "Prioritized remediation guidance tied to your environment",
  "Documented response paths when something needs escalation",
];

/** Verbatim from the published homepage FAQ (DigeratiFAQSection), minus the dashes. */
const FAQ = [
  {
    q: "What is your best service?",
    a: "There is no universally “best” package. ProActive is four operating models, IT, Office, Business and Enterprise, matched to users, devices, locations, infrastructure, security, compliance, and whether you need fully or co-managed coverage. If Office would need heavy modification, Business is the correct fit for that environment, not a higher rank.",
  },
  {
    q: "How do I choose the right plan for my business?",
    a: "User count is a signal, never the sole criterion. We start with a Cyber Risk Assessment of your environment, then match IT, Office, Business or Enterprise. We do not start with a package and pile on add-ons.",
  },
  {
    q: "Can I customize the solutions?",
    a: "Yes. Every business is unique. Our packages can be customized with additional services, and we offer both co-managed and fully managed options to fit your existing IT structure.",
  },
  {
    q: "Is my data secure?",
    a: "Yes. We use enterprise-grade controls, 24/7 monitoring and documented security protocols. We help Arizona businesses prepare for HIPAA, PCI DSS, SOC 2 and cyber-insurance reviews, with clear ownership of credentials, policies and evidence.",
  },
];

/** The live newsletter section's compliance chips, with its own disclaimer kept. */
const COMPLIANCE = ["HIPAA-aligned security and compliance", "SOC 2 readiness and control alignment", "Cyber insurance readiness", "Security and compliance reporting"];

/** The live CTA section's four items (DigeratiCTASection). */
const CTA_ITEMS = ["Audit readiness support", "Microsoft-aligned stack", "HIPAA-minded controls", "Documented standards"];

/** Office hours as published on the live contact section (DigeratiContactSection). */
const HOURS = { weekdays: "Monday to Friday, 7:00 AM to 6:00 PM MST", weekend: "Saturday and Sunday: emergency support only. 24/7/365 emergency incident response." };

const FOOTER = [
  {
    title: "Client",
    links: [
      { href: "https://portal.digeratiexperts.com/portal/login", label: "Client Portal", external: true },
      { href: "/support/submit-ticket", label: "Submit a ticket" },
      { href: "https://assist.zoho.com/", label: "Remote support", external: true },
      { href: "/support/pay-invoice", label: "Pay an invoice" },
    ],
  },
  {
    title: "Services",
    links: [
      { href: "/solutions/managed-it-support", label: "Managed IT" },
      { href: "/solutions/security-operations", label: "Cybersecurity" },
      { href: "/solutions/compliance-reports", label: "Compliance and risk" },
      { href: "/solutions/backup-disaster-recovery", label: "Backup and DR" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/resources/blog", label: "Digerati Journal" },
      { href: "/resources/cyber-facts", label: "Cyber facts" },
      { href: "/support/knowledge-base", label: "Knowledge base" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Trust and legal",
    links: [
      { href: "/trust/trust-center", label: "Trust Center" },
      { href: "/trust/vulnerability-disclosure", label: "Vulnerability disclosure" },
      { href: "/legal/privacy-policy", label: "Privacy" },
      { href: "/legal/terms-of-use", label: "Terms" },
      { href: "/legal/msa", label: "MSA" },
      { href: "/legal/sla", label: "SLA" },
    ],
  },
];

type Review = { id: string; authorName: string; rating: number; text: string; sourceLabel?: string };

/** Real reviews only, from the live feed. */
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

type SendState = "idle" | "sending" | "sent" | "error";

async function postJson(url: string, body: Record<string, string>): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return res.ok;
  } catch {
    return false;
  }
}

function PrimaryAction({ className = "" }: { className?: string }) {
  return (
    <Link href={BOOK} className={`v6-btn v6-btn-primary ${className}`} data-v6-cta="primary" data-testid="v6-primary-action">
      {ACTION}
    </Link>
  );
}

function Status({ state, sent }: { state: SendState; sent: string }) {
  if (state === "sent") return <p className="v6-status v6-status-ok" role="status">{sent}</p>;
  if (state === "error") return <p className="v6-status v6-status-err" role="alert">Something went wrong. Please try again, or call {PRIMARY_PHONE.display}.</p>;
  if (state === "sending") return <p className="v6-status" role="status">Sending.</p>;
  return null;
}

/** Posts to /api/assessment with the same fields the live lead form sends. */
function AssessmentForm() {
  const [state, setState] = useState<SendState>("idle");
  const [v, setV] = useState({ fullName: "", email: "", phone: "", company: "" });
  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setState("sending");
    const ok = await postJson("/api/assessment", { ...v, source: "lead_form" });
    setState(ok ? "sent" : "error");
  };
  return (
    <form className="v6-formcard v6-form" onSubmit={onSubmit} aria-label="Request a Cyber Risk Assessment">
      <div className="v6-form-row">
        <div className="v6-field">
          <label htmlFor="v6-lead-name">Full name</label>
          <input id="v6-lead-name" className="v6-input" required minLength={2} maxLength={50} autoComplete="name" placeholder="Your name" value={v.fullName} onChange={(e) => setV({ ...v, fullName: e.target.value })} />
        </div>
        <div className="v6-field">
          <label htmlFor="v6-lead-email">Work email</label>
          <input id="v6-lead-email" className="v6-input" type="email" required autoComplete="email" placeholder="name@company.com" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
        </div>
      </div>
      <div className="v6-form-row">
        <div className="v6-field">
          <label htmlFor="v6-lead-phone">Phone (optional)</label>
          <input id="v6-lead-phone" className="v6-input" type="tel" autoComplete="tel" placeholder="(480) 000-0000" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
        </div>
        <div className="v6-field">
          <label htmlFor="v6-lead-company">Company (optional)</label>
          <input id="v6-lead-company" className="v6-input" autoComplete="organization" placeholder="Company name" value={v.company} onChange={(e) => setV({ ...v, company: e.target.value })} />
        </div>
      </div>
      <button type="submit" className="v6-btn v6-btn-primary" disabled={state === "sending"}>
        Send the request
      </button>
      <Status state={state} sent="Thank you. We will be in touch within one business day to schedule your assessment." />
      {state !== "sent" && <p className="v6-muted">We respond within one business day.</p>}
    </form>
  );
}

/** Posts to /api/contact with the same fields the live contact form sends. */
function ContactForm() {
  const [state, setState] = useState<SendState>("idle");
  const [v, setV] = useState({ name: "", email: "", phone: "", company: "", service: "", message: "" });
  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setState("sending");
    const ok = await postJson("/api/contact", v);
    setState(ok ? "sent" : "error");
  };
  return (
    <form className="v6-formcard" onSubmit={onSubmit} aria-labelledby="v6-contact-form-h">
      <div>
        <h3 id="v6-contact-form-h">Send a message</h3>
        <p className="v6-muted" style={{ marginTop: 4 }}>Tell us about the environment. We follow up on a Cyber Risk Assessment, no pressure.</p>
      </div>
      <div className="v6-form">
        <div className="v6-field">
          <label htmlFor="v6-c-name">Full name</label>
          <input id="v6-c-name" className="v6-input" required minLength={2} maxLength={50} autoComplete="name" placeholder="Your name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </div>
        <div className="v6-form-row">
          <div className="v6-field">
            <label htmlFor="v6-c-email">Business email</label>
            <input id="v6-c-email" className="v6-input" type="email" required autoComplete="email" placeholder="name@company.com" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
          </div>
          <div className="v6-field">
            <label htmlFor="v6-c-phone">Phone</label>
            <input id="v6-c-phone" className="v6-input" type="tel" required autoComplete="tel" placeholder="(480) 000-0000" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
          </div>
        </div>
        <div className="v6-field">
          <label htmlFor="v6-c-company">Company</label>
          <input id="v6-c-company" className="v6-input" autoComplete="organization" placeholder="Company name" value={v.company} onChange={(e) => setV({ ...v, company: e.target.value })} />
        </div>
        <div className="v6-field">
          <label htmlFor="v6-c-service">Service interested in</label>
          <select id="v6-c-service" className="v6-input" value={v.service} onChange={(e) => setV({ ...v, service: e.target.value })}>
            <option value="">Select a service</option>
            <option value="assessment">Security assessment</option>
            <option value="managed-it">Managed IT services</option>
            <option value="managed-security">Managed security services</option>
            <option value="compliance">Compliance and governance</option>
            <option value="incident-response">Incident response</option>
          </select>
        </div>
        <div className="v6-field">
          <label htmlFor="v6-c-message">Message</label>
          <textarea id="v6-c-message" className="v6-input" required minLength={10} maxLength={500} placeholder="Tell us about your security needs" value={v.message} onChange={(e) => setV({ ...v, message: e.target.value })} />
        </div>
        <button type="submit" className="v6-btn v6-btn-primary" disabled={state === "sending"}>
          Send message
        </button>
        <Status state={state} sent="Message sent. We will get back to you within one business day." />
      </div>
    </form>
  );
}

/** Posts to /api/newsletter with the same field the live forms send. */
function NewsletterForm() {
  const [state, setState] = useState<SendState>("idle");
  const [email, setEmail] = useState("");
  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setState("sending");
    const ok = await postJson("/api/newsletter", { email });
    setState(ok ? "sent" : "error");
  };
  return (
    <form onSubmit={onSubmit} aria-label="Monthly security notes">
      <div className="v6-sub">
        <div className="v6-field">
          <label htmlFor="v6-news-email">Email</label>
          <input id="v6-news-email" className="v6-input" type="email" required autoComplete="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button type="submit" className="v6-btn v6-btn-primary" style={{ alignSelf: "end" }} disabled={state === "sending"}>
          Subscribe
        </button>
      </div>
      <Status state={state} sent="Subscribed. The next note comes with the month." />
      {state !== "sent" && <p className="v6-muted" style={{ marginTop: 10 }}>Unsubscribe anytime. We respect your privacy.</p>}
    </form>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function HomepageV6(): JSX.Element {
  useSEO({
    title: "Managed IT and Cybersecurity for Arizona Businesses",
    description:
      "Arizona MSP/MSSP. Cybersecurity-first managed IT, written response times, published prices, and a Cyber Risk Assessment that matches the operating model to your environment.",
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
  const threats = useThreatFeed("homepage");
  const facts = getHomepageCyberFacts();
  const blocks = protectionDomains.filter((d) => !d.continuous);
  const continuous = protectionDomains.find((d) => d.continuous);
  const year = new Date().getFullYear();
  const region = COMPANY.addressRegion === "AZ" ? "Arizona" : COMPANY.addressRegion;

  return (
    <div className="v6" data-testid="homepage-v6">
      <header className="v6-header">
        <div className="v6-wrap v6-header-inner">
          <Link href="/" className="v6-logo" aria-label="Digerati Experts home">
            <img src={DE_LOGO_PRIMARY} alt="Digerati Experts" width="180" height="34" />
          </Link>
          <nav className="v6-nav" aria-label="Main">
            <ul>
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="v6-header-actions">
            <a className="v6-phone" href={PRIMARY_PHONE.telHref} aria-label={`Call ${PRIMARY_PHONE.display}`}>
              {PRIMARY_PHONE.display}
            </a>
            <PrimaryAction className="v6-header-cta" />
            <details className="v6-menu">
              <summary aria-label="Open menu">Menu</summary>
              <div className="v6-menu-panel">
                {NAV.map((item) => (
                  <Link key={item.href} href={item.href}>
                    {item.label}
                  </Link>
                ))}
                <a href={PRIMARY_PHONE.telHref}>Call {PRIMARY_PHONE.display}</a>
                <PrimaryAction className="v6-menu-cta" />
              </div>
            </details>
          </div>
        </div>
      </header>

      <main id="v6-main">
        {/* 1. Hero */}
        <section className="v6-hero" aria-labelledby="v6-h1">
          <div className="v6-wrap v6-hero-grid">
            <div className="v6-hero-copy">
              <p className="v6-eyebrow">
                {COMPANY.addressLocality}, {region} · Greater Phoenix
              </p>
              <h1 id="v6-h1">Managed IT and cybersecurity for Arizona businesses.</h1>
              <p className="v6-lede">
                One accountable team for support, identity, endpoints, email, backup and security operations. We assess first, then
                match the operating model to your environment.
              </p>
              <div className="v6-actions">
                <PrimaryAction />
                <a className="v6-btn v6-btn-secondary" href={PRIMARY_PHONE.telHref}>
                  Call {PRIMARY_PHONE.display}
                </a>
              </div>
            </div>
            <figure className="v6-hero-figure">
              <picture>
                <source srcSet={FOUNDER_WEBP} type="image/webp" />
                <img src={FOUNDER_JPG} alt="Joseph Petro, founder of Digerati Experts" width="768" height="1024" loading="eager" decoding="async" />
              </picture>
              <figcaption>Joseph Petro, founder. {COMPANY.addressLocality}, {region}.</figcaption>
            </figure>
          </div>
          <div className="v6-wrap">
            <ul className="v6-facts" aria-label="Three facts">
              <li className="v6-fact">
                <strong className="v6-num">{formatPrice(pricing.it.user)} per user a month</strong>
                <span className="v6-num">Starting price. {formatPrice(pricing.it.monthlyMinimum)} monthly minimum.</span>
              </li>
              <li className="v6-fact">
                <strong>15 minutes</strong>
                <span>Written response time for a critical issue.</span>
              </li>
              <li className="v6-fact">
                <strong>24/7/365</strong>
                <span>Emergency incident response availability.</span>
              </li>
            </ul>
          </div>
        </section>

        {/* 2. Why we exist */}
        <section className="v6-section v6-alt" aria-labelledby="v6-why">
          <div className="v6-wrap">
            <div className="v6-head">
              <p className="v6-eyebrow">Why we exist</p>
              <h2 id="v6-why">A security-first partner, not another vendor.</h2>
              <p className="v6-lede">Most business leaders do not want one more vendor. They want a partner who reduces risk and keeps the team moving.</p>
            </div>
            <div className="v6-strip">
              {WHY_WE_EXIST.map((w) => (
                <div key={w.title}>
                  <b>{w.title}</b>
                  <p>{w.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3. The sourced figures */}
        <section className="v6-section" aria-labelledby="v6-stats">
          <div className="v6-wrap">
            <div className="v6-head">
              <p className="v6-eyebrow">Why it matters</p>
              <h2 id="v6-stats">The threats are real. The numbers are sourced.</h2>
              <p className="v6-lede">Four figures from public reports, each linked to its source.</p>
            </div>
            <ul className="v6-stats">
              {facts.map((f) => (
                <li key={f.id} className="v6-stat">
                  <b className="v6-num">{f.metric}</b>
                  <span>{f.statement}</span>
                  <small>
                    <a href={f.sourceUrl} rel="noopener noreferrer" target="_blank">
                      {f.source}, {f.year}
                    </a>
                  </small>
                </li>
              ))}
            </ul>
            <Link href="/resources/cyber-facts" className="v6-more">
              All sourced facts, with links to the reports
            </Link>
          </div>
        </section>

        {/* 4. What we tackle */}
        <section className="v6-section v6-alt" aria-labelledby="v6-tackle">
          <div className="v6-wrap">
            <div className="v6-head">
              <p className="v6-eyebrow">Problems we solve</p>
              <h2 id="v6-tackle">What we tackle</h2>
              <p className="v6-lede">Six problems we own with you.</p>
            </div>
            <ul className="v6-cards">
              {TACKLE.map((t) => (
                <li key={t.title} className="v6-card">
                  <h3>{t.title}</h3>
                  <p>{t.body}</p>
                  <Link href={t.href} className="v6-more">
                    {t.link}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 5. How to work with us */}
        <section className="v6-section" aria-labelledby="v6-paths">
          <div className="v6-wrap">
            <div className="v6-head">
              <p className="v6-eyebrow">How to work with us</p>
              <h2 id="v6-paths">Three clear paths.</h2>
              <p className="v6-lede">Start with an assessment, then choose how much you want to own together.</p>
            </div>
            <ul className="v6-cards">
              {PATHS.map((p) => (
                <li key={p.title} className="v6-card">
                  <p className="v6-kicker">{p.kicker}</p>
                  <h3>{p.title}</h3>
                  <p>{p.body}</p>
                  <Link href={p.href} className="v6-more">
                    {p.link}
                  </Link>
                </li>
              ))}
            </ul>
            <h3 style={{ marginTop: 44 }}>What the ProActive Ecosystem manages</h3>
            <ul className="v6-caps">
              {CAPABILITIES.map((c) => (
                <li key={c.title}>
                  <b>
                    <Link href={c.href}>{c.title}</Link>
                  </b>
                  <span>{c.body}</span>
                </li>
              ))}
            </ul>
            <p className="v6-muted" style={{ marginTop: 20 }}>
              Need one specific service? <Link href="/solutions/standalone-services">Standalone services</Link>
            </p>
          </div>
        </section>

        {/* 6. The eight blocks and the four steps */}
        <section className="v6-section v6-alt" aria-labelledby="v6-protect">
          <div className="v6-wrap">
            <div className="v6-head">
              <p className="v6-eyebrow">What we protect</p>
              <h2 id="v6-protect">Eight blocks. One accountable operating model.</h2>
              <p className="v6-lede">Seven blocks answer a threat class each. Risk and exposure runs continuously beneath all seven as the visibility and intelligence layer.</p>
            </div>
            <ul className="v6-blocks">
              {blocks.map((d) => (
                <li key={d.id} className="v6-block">
                  <b>{d.name}</b>
                  <span>{d.architecture.nodes.map((n) => n.title).join(". ")}.</span>
                </li>
              ))}
              <li className="v6-block v6-block-note">Exact scope, controls and cadence depend on the operating model matched to your environment.</li>
              {continuous && (
                <li className="v6-block v6-block-wide">
                  <b>{continuous.name}</b>
                  <span>{continuous.purpose}</span>
                </li>
              )}
            </ul>
            <hr className="v6-divider" />
            <div className="v6-head" style={{ marginBottom: 28 }}>
              <p className="v6-eyebrow">How protection works</p>
              <h2>Assessment, roadmap, implementation, continuous.</h2>
            </div>
            <ol className="v6-steps">
              {STEPS.map((s) => (
                <li key={s.title} className="v6-step">
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </li>
              ))}
            </ol>
            <Link href="/solutions/proactive-ecosystem" className="v6-more" style={{ marginTop: 24 }}>
              Full methodology
            </Link>
          </div>
        </section>

        {/* 7. Client proof */}
        <section className="v6-section" aria-labelledby="v6-proof">
          <div className="v6-wrap">
            <div className="v6-head">
              <p className="v6-eyebrow">Client proof</p>
              <h2 id="v6-proof">What clients hire us to improve</h2>
            </div>
            <div className="v6-strip">
              {OUTCOMES.map((o) => (
                <div key={o.title}>
                  <b>{o.title}</b>
                  <p>{o.body}</p>
                </div>
              ))}
            </div>
            {reviews.length > 0 ? (
              <ul className="v6-cards" style={{ marginTop: 32 }} aria-label="Client reviews">
                {reviews.map((r) => (
                  <li key={r.id} className="v6-card">
                    <p className="v6-kicker" aria-label={`${r.rating} out of 5`}>
                      {r.rating}/5{r.sourceLabel ? ` · ${r.sourceLabel}` : ""}
                    </p>
                    <p>{r.text}</p>
                    <b>{r.authorName}</b>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="v6-box" style={{ marginTop: 32 }}>
                <h3>Client reviews</h3>
                <p className="v6-lede">
                  We show reviews only from the live Google feed or verbatim published reviews. None are published yet, so this space
                  stays empty.
                </p>
                <a href={COMPANY.mapsUrl} rel="noopener noreferrer" target="_blank" className="v6-more" style={{ marginTop: 2 }}>
                  Read us on Google
                </a>
              </div>
            )}
            <ul className="v6-cards v6-cards-4" style={{ marginTop: 16 }}>
              {PROOF.map((p) => (
                <li key={p.href} className="v6-card">
                  <h3>{p.title}</h3>
                  <p>{p.body}</p>
                  <Link href={p.href} className="v6-more">
                    {p.link}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 8. Fits how you operate, with the written response times */}
        <section className="v6-section v6-alt" aria-labelledby="v6-fit">
          <div className="v6-wrap v6-two">
            <div>
              <div className="v6-head" style={{ marginBottom: 28 }}>
                <p className="v6-eyebrow">Why Arizona businesses work with us</p>
                <h2 id="v6-fit">Protection that fits how you actually operate.</h2>
                <p className="v6-lede">
                  From medical practices to law firms to family-owned offices, we protect the businesses Arizona runs on: the ones that
                  cannot afford downtime, a breach or lost client data.
                </p>
              </div>
              <ul className="v6-list">
                {PILLARS.map((p) => (
                  <li key={p.title}>
                    <b>{p.title}</b>
                    {p.body}
                  </li>
                ))}
              </ul>
              <div className="v6-actions" style={{ marginTop: 28 }}>
                <PrimaryAction />
              </div>
            </div>
            <div>
              <h3>Response times, in writing</h3>
              <table className="v6-table" style={{ marginTop: 14 }}>
                <thead>
                  <tr>
                    <th scope="col">Severity</th>
                    <th scope="col">Response</th>
                  </tr>
                </thead>
                <tbody>
                  {SLA_ROWS.map((r) => (
                    <tr key={r.severity}>
                      <td>
                        <strong>{r.severity}</strong>
                        <span className="v6-table-meaning">{r.meaning}</span>
                      </td>
                      <td className="v6-num">{r.response}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="v6-muted" style={{ marginTop: 12 }}>
                From the published <Link href="/legal/sla">Service Level Agreement</Link>. 24/7/365 emergency incident response; service credits
                when we miss a target.
              </p>
            </div>
          </div>
        </section>

        {/* 9. The people */}
        <section className="v6-section" aria-labelledby="v6-people">
          <div className="v6-wrap">
            <div className="v6-head">
              <p className="v6-eyebrow">The people behind your technology</p>
              <h2 id="v6-people">Principal-led, from {COMPANY.addressLocality}.</h2>
              <p className="v6-lede">When something happens, you should know who owns it, not wonder which anonymous queue picked up your ticket.</p>
            </div>
            <div className="v6-team">
              <figure>
                <picture>
                  <source srcSet={FOUNDER_WEBP} type="image/webp" />
                  <img src={FOUNDER_JPG} alt="Joseph Petro" width="768" height="1024" loading="lazy" decoding="async" />
                </picture>
                <figcaption>
                  <b>Joseph Petro</b>
                  <br />
                  <span className="v6-muted">Founder and Chief Technology Strategist</span>
                </figcaption>
              </figure>
              <div>
                <p className="v6-lede" style={{ fontSize: "1.0625rem" }}>
                  Based in {COMPANY.addressLocality}, {region}. Joe stays directly involved in risk assessments, infrastructure architecture
                  and key client milestones, so growing organizations get cybersecurity-first managed IT without becoming account number four
                  thousand.
                </p>
                <ul className="v6-cards" style={{ marginTop: 24 }}>
                  {ROLES.map((r) => (
                    <li key={r.title} className="v6-card">
                      <h3>{r.title}</h3>
                      <p>{r.body}</p>
                    </li>
                  ))}
                </ul>
                <div className="v6-actions" style={{ marginTop: 24 }}>
                  <Link href="/about/team" className="v6-btn v6-btn-secondary">
                    Meet the team
                  </Link>
                  <PrimaryAction />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 10. Industries */}
        <section className="v6-section v6-alt" aria-labelledby="v6-industries">
          <div className="v6-wrap">
            <div className="v6-head">
              <p className="v6-eyebrow">Who we work with</p>
              <h2 id="v6-industries">Industries we serve</h2>
              <p className="v6-lede">Specialized protection for Arizona's essential sectors.</p>
            </div>
            <ul className="v6-cards v6-cards-5">
              {INDUSTRIES.map((i) => (
                <li key={i.href} className="v6-card">
                  <h3>
                    <Link href={i.href}>{i.title}</Link>
                  </h3>
                  <p>{i.body}</p>
                  <Link href={i.href} className="v6-more" aria-label={`${i.title}: view the page`}>
                    View
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/industries" className="v6-more" style={{ marginTop: 24 }}>
              All industries
            </Link>
          </div>
        </section>

        {/* 11. Pricing */}
        <section className="v6-section" aria-labelledby="v6-pricing">
          <div className="v6-wrap">
            <div className="v6-head">
              <p className="v6-eyebrow">Pricing</p>
              <h2 id="v6-pricing">Four operating models. One matched to your environment.</h2>
              <p className="v6-lede">We do not start with a package and pile on add-ons. User count is a signal, never the sole criterion.</p>
            </div>
            <ul className="v6-tiers">
              {pricingTiers.map((t) => (
                <li key={t.id} className="v6-tier">
                  <p className="v6-tier-badge">{t.label}</p>
                  <p className="v6-price v6-num">{formatPrice(t.user)}</p>
                  <p className="v6-muted v6-num">
                    per user per month · {formatPrice(t.monthlyMinimum)} monthly minimum
                  </p>
                  <p className="v6-tier-desc">{t.idealBuyer}</p>
                  <ul aria-label={`${t.label} includes`}>
                    {t.inclusions.slice(0, 3).map((inc) => (
                      <li key={inc}>{inc}</li>
                    ))}
                  </ul>
                  <Link href={t.learnMoreUrl} className="v6-more">
                    See what's included
                  </Link>
                </li>
              ))}
            </ul>
            <p className="v6-note">{PRICING_SCOPE_NOTE}</p>
            <div className="v6-actions" style={{ marginTop: 22 }}>
              <PrimaryAction />
              <Link href="/proactive-ecosystem-pricing" className="v6-btn v6-btn-secondary">
                Compare everything
              </Link>
            </div>
          </div>
        </section>

        {/* 12. Security updates and detection */}
        <section className="v6-section v6-alt" aria-labelledby="v6-updates">
          <div className="v6-wrap v6-two">
            <div>
              <div className="v6-head" style={{ marginBottom: 24 }}>
                <p className="v6-eyebrow">Security updates</p>
                <h2 id="v6-updates">Recent threats and insights</h2>
                <p className="v6-lede">Items prioritized by active exploitation, exploit probability and SMB relevance, within the last 45 days.</p>
              </div>
              {threats.payload.items.length > 0 ? (
                <ul className="v6-feed" aria-label="Current security updates">
                  {threats.payload.items.slice(0, 3).map((item) => (
                    <li key={item.id}>
                      <a href={item.sourceUrl} rel="noopener noreferrer" target="_blank">
                        {item.title}
                      </a>
                      <span className="v6-muted">
                        {item.kicker} · {item.sourceName} · {formatDate(item.publishedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="v6-box">
                  <b>{threats.loading ? "Checking the feed." : "Nothing meets the homepage threshold right now."}</b>
                  <p className="v6-muted">The full stream, with dates and sources, is on Security Updates.</p>
                </div>
              )}
              <p className="v6-muted" style={{ marginTop: 12 }}>{THREAT_ATTRIBUTION}</p>
              <div className="v6-actions" style={{ marginTop: 20 }}>
                <Link href="/resources/security-updates" className="v6-btn v6-btn-secondary">
                  View all security updates
                </Link>
                <Link href="/resources/blog" className="v6-more" style={{ margin: 0 }}>
                  Read the Digerati Journal
                </Link>
              </div>
            </div>
            <div>
              <div className="v6-head" style={{ marginBottom: 24 }}>
                <p className="v6-eyebrow">Detection and response</p>
                <h2>Monitoring that ends with a person who owns the outcome.</h2>
                <p className="v6-lede">
                  Modern detection tooling surfaces signals immediately. Then our team investigates, prioritizes and tells you what matters.
                  Technology scales coverage; accountability stays human.
                </p>
              </div>
              <ul className="v6-list v6-check">
                {DETECTION_POINTS.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
              <ul className="v6-cards v6-cards-2" style={{ marginTop: 24 }}>
                <li className="v6-card">
                  <h3>Coverage with context</h3>
                  <p>Alerts are interpreted against your specific environment, never dumped into an unmonitored ticket queue.</p>
                </li>
                <li className="v6-card">
                  <h3>Documented next steps</h3>
                  <p>Findings translate into steps your executive and IT teams can execute without decoding jargon.</p>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* 13. The assessment form */}
        <section className="v6-section" aria-labelledby="v6-book">
          <div className="v6-wrap v6-two">
            <div>
              <div className="v6-head" style={{ marginBottom: 28 }}>
                <p className="v6-eyebrow">Cyber Risk Assessment</p>
                <h2 id="v6-book">Book your Cyber Risk Assessment.</h2>
                <p className="v6-lede">
                  Find identity, endpoint, email, backup and operating gaps before you buy a package. Independent findings, written in plain
                  language.
                </p>
              </div>
              <ul className="v6-list v6-check">
                <li>Independent findings you keep either way</li>
                <li>No switch required</li>
                <li>Arizona-based experts</li>
                <li>No obligation, no credit card</li>
              </ul>
              <div className="v6-actions" style={{ marginTop: 28 }}>
                <PrimaryAction />
                <a className="v6-phone" href={PRIMARY_PHONE.telHref}>
                  or call {PRIMARY_PHONE.display}
                </a>
              </div>
            </div>
            <AssessmentForm />
          </div>
        </section>

        {/* 14. Questions, compliance, the monthly note, the cities */}
        <section className="v6-section v6-alt" aria-labelledby="v6-faq">
          <div className="v6-wrap">
            <div className="v6-head">
              <p className="v6-eyebrow">Questions</p>
              <h2 id="v6-faq">Straight answers on how we work.</h2>
            </div>
            <div className="v6-faq">
              {FAQ.map((f, i) => (
                <details key={f.q} open={i === 0}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
            <hr className="v6-divider" />
            <div className="v6-two">
              <div>
                <h3>Security and compliance support</h3>
                <p className="v6-muted" style={{ margin: "8px 0 14px" }}>
                  Framework names describe requirements we help organizations address, not certifications {COMPANY.legalName} holds.
                </p>
                <div className="v6-chips">
                  {COMPLIANCE.map((c) => (
                    <span key={c}>{c}</span>
                  ))}
                </div>
              </div>
              <div>
                <h3 style={{ marginBottom: 14 }}>Monthly security notes for Arizona operators</h3>
                <NewsletterForm />
                <h3 style={{ marginTop: 28 }}>Serving Greater Phoenix</h3>
                <p className="v6-muted" style={{ marginTop: 6 }}>{COMPANY.areaServed}</p>
              </div>
            </div>
          </div>
        </section>

        {/* 15. The one dark band */}
        <section className="v6-section v6-dark" aria-labelledby="v6-cta">
          <div className="v6-wrap">
            <div className="v6-head" style={{ maxWidth: 820 }}>
              <p className="v6-eyebrow">Cyber Risk Assessment</p>
              <h2 id="v6-cta">Start with a Cyber Risk Assessment.</h2>
              <p className="v6-lede">
                Discover identity, endpoint, email, backup and operating gaps before you buy a package. Assessment-led recommendations; final
                scope confirmed after we see the environment.
              </p>
            </div>
            <ul className="v6-inline-list">
              {CTA_ITEMS.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <div className="v6-actions" style={{ marginTop: 32 }}>
              <PrimaryAction />
              <a className="v6-btn v6-btn-secondary" href={PRIMARY_PHONE.telHref}>
                Call {PRIMARY_PHONE.display}
              </a>
            </div>
          </div>
        </section>

        {/* 16. Contact */}
        <section className="v6-section v6-contact" aria-labelledby="v6-contact">
          <div className="v6-wrap v6-two">
            <div>
              <div className="v6-head" style={{ marginBottom: 28 }}>
                <p className="v6-eyebrow">Contact</p>
                <h2 id="v6-contact">Talk to a person in {COMPANY.addressLocality}.</h2>
                <p className="v6-lede">Ask about an assessment, a quote or an existing environment. A person answers.</p>
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
                  <dt>Hours</dt>
                  <dd>
                    {HOURS.weekdays}
                    <br />
                    <span className="v6-muted">{HOURS.weekend}</span>
                  </dd>
                </div>
                <div>
                  <dt>Follow</dt>
                  <dd>
                    {Object.values(COMPANY_SOCIAL).map((s, i) => (
                      <span key={s.href}>
                        {i > 0 ? " · " : ""}
                        <a href={s.href} rel="noopener noreferrer" target="_blank">
                          {s.name}
                        </a>
                      </span>
                    ))}
                  </dd>
                </div>
              </dl>
            </div>
            <ContactForm />
          </div>
        </section>
      </main>

      {/* 17. Footer */}
      <footer className="v6-footer">
        <div className="v6-wrap">
          <div className="v6-footer-grid">
            <div>
              <Link href="/" className="v6-logo" aria-label="Digerati Experts home">
                <img src={DE_LOGO_PRIMARY} alt="Digerati Experts" width="158" height="30" />
              </Link>
              <p style={{ marginTop: 14, maxWidth: "34ch" }}>
                Cybersecurity-first managed IT for Arizona businesses. {COMPANY.addressLocality}, {region}.
              </p>
              <p style={{ marginTop: 10 }}>
                <a href={PRIMARY_PHONE.telHref}>
                  <b>{PRIMARY_PHONE.display}</b>
                </a>{" "}
                · <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
              </p>
            </div>
            {FOOTER.map((col) => (
              <div key={col.title}>
                <h3>{col.title}</h3>
                <ul>
                  {col.links.map((l) => (
                    <li key={l.href}>
                      {l.external ? (
                        <a href={l.href} rel="noopener noreferrer" target="_blank">
                          {l.label}
                        </a>
                      ) : (
                        <Link href={l.href}>{l.label}</Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="v6-footer-bottom">
            <span>
              © {year} {COMPANY.legalName} · {COMPANY.addressLocality}, {region}
            </span>
            <ul aria-label="Social">
              {Object.values(COMPANY_SOCIAL).map((s) => (
                <li key={s.href}>
                  <a href={s.href} rel="noopener noreferrer" target="_blank">
                    {s.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
