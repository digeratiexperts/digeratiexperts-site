import { PageTemplate } from "@/components/PageTemplate";
import {
  Phone,
  MapPin,
  Building2,
  Archive,
  Hash,
  GitBranch,
  Shield,
  Video,
  FileText,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { ServiceJsonLd, BreadcrumbJsonLd } from "@/components/JsonLd";
import { CTA } from "@/lib/ctaCopy";
import { IconWell } from "@/components/visual/IconWell";
import {
  Chapter,
  Container,
  ChapterHeader,
  CheckList,
  ClosingCta,
  HeroActions,
  HeroFacts,
  bodyClass,
  cardDark,
  cardPaper,
  inkClass,
  type ChapterTone,
} from "@/components/site/chapters";

const testSlug = (t: string) => t.toLowerCase().replace(/\s+/g, "-");

/** Icon cards with per-card test ids (FeatureGrid has no id hook). */
function IconCards({
  items,
  tone,
  testPrefix,
  columns,
}: {
  items: { icon: LucideIcon; title: string; description: string }[];
  tone: ChapterTone;
  testPrefix: string;
  columns: 3 | 4;
}) {
  return (
    <ul className={`grid gap-4 sm:grid-cols-2 md:gap-5 ${columns === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
      {items.map((item) => (
        <li
          key={item.title}
          className={`${tone === "paper" ? cardPaper : cardDark} flex flex-col p-6`}
          data-testid={`${testPrefix}-${testSlug(item.title)}`}
        >
          <IconWell icon={item.icon} surface={tone === "paper" ? "light" : "dark"} className="mb-5" />
          <h3 className={`font-heading text-lg font-semibold leading-snug ${inkClass(tone)}`}>{item.title}</h3>
          <p className={`mt-2 text-[0.95rem] leading-relaxed ${bodyClass(tone)}`}>{item.description}</p>
        </li>
      ))}
    </ul>
  );
}

export default function UCaaS() {
  useSEO({
    title: "UCaaS Voice & Meetings | Managed Phone Systems",
    description: "We design, secure, and run your phone system and meeting stack so it actually supports the business. E911 compliance, call routing, retention policies, and 24/7 support.",
    canonical: "/services/ucaas",
  });

  const brokenItems = [
    {
      icon: GitBranch,
      title: "Routing",
      description: "Calls go to the wrong person or get dropped. Ring groups and auto-attendants aren't set up correctly, frustrating customers."
    },
    {
      icon: MapPin,
      title: "E911",
      description: "Your address records are outdated or wrong. In an emergency, first responders could be sent to the wrong location."
    },
    {
      icon: Building2,
      title: "Too many vendors",
      description: "Phone from one vendor, meetings from another, fax from a third. Nobody owns the stack, so problems fall through the cracks."
    },
    {
      icon: Archive,
      title: "No retention",
      description: "Call recordings and voicemails vanish after 30 days. When you need them for compliance or disputes, they're gone."
    }
  ];

  const hiddenBillItems = {
    business: [
      "Lost sales from missed or misrouted calls",
      "Wasted time troubleshooting without expert help",
      "Productivity loss during outages",
      "Customer frustration from poor call quality"
    ],
    liability: [
      "E911 non-compliance fines (up to $10,000 per violation)",
      "HIPAA violations for unencrypted health calls",
      "Legal discovery failures from missing recordings",
      "FTC compliance gaps for financial services"
    ]
  };

  const serviceCards = [
    {
      icon: Hash,
      title: "Number procurement",
      description: "We port existing numbers and provision new DIDs with proper documentation. Never lose a business number again."
    },
    {
      icon: GitBranch,
      title: "Call flow / IVR",
      description: "Custom auto-attendants, ring groups, hunt groups, and after-hours routing designed around how your team actually works."
    },
    {
      icon: Shield,
      title: "E911 compliance",
      description: "Location records updated for every user, every site. Dispatchable addresses verified quarterly. Full audit trail."
    },
    {
      icon: Video,
      title: "Meetings governance",
      description: "Zoom/Teams/Meet policies enforced across your org. Waiting rooms, passwords, recording rules—all configured to spec."
    },
    {
      icon: FileText,
      title: "Retention policy",
      description: "Call recordings, voicemails, and meeting recordings retained for your compliance window. Automated purge when allowed."
    },
    {
      icon: BarChart3,
      title: "Quality reporting",
      description: "Monthly reports on call quality, uptime, usage patterns, and cost. Actionable insights, not just data dumps."
    }
  ];

  const pricingTiers = [
    {
      name: "SOW Implementation",
      type: "one-time",
      price: "From $1,500",
      description: "One-time project to set up or fix your UCaaS stack",
      features: [
        "Platform audit & gap analysis",
        "Number porting coordination",
        "Call flow design & implementation",
        "E911 address verification",
        "User training session",
        "Documentation & runbook"
      ]
    },
    {
      name: "Managed UCaaS",
      type: "monthly",
      price: "$12/user/mo",
      description: "Ongoing management for your voice and meetings stack",
      features: [
        "24/7 phone system support",
        "User adds/changes/deletes",
        "E911 quarterly audits",
        "Call recording management",
        "Meeting policy enforcement",
        "Monthly quality reports"
      ],
      popular: false
    },
    {
      name: "Managed UCaaS + Platform",
      type: "monthly",
      price: "$35/user/mo",
      description: "Full stack: platform licenses plus management",
      features: [
        "Everything in Managed UCaaS",
        "Cytracom or Teams Phone license",
        "Unlimited US/CA calling",
        "Voicemail to email",
        "Mobile & desktop apps",
        "Call center queue (add-on)"
      ]
    }
  ];

  const comparisonItems = [
    { feature: "Initial setup", diy: "You figure it out", digerati: "White-glove implementation" },
    { feature: "E911 compliance", diy: "Hope it's right", digerati: "Verified quarterly" },
    { feature: "Call flow changes", diy: "Open a ticket, wait", digerati: "Same-day turnaround" },
    { feature: "Retention policy", diy: "Default 30 days", digerati: "Custom to your compliance" },
    { feature: "Quality issues", diy: "Escalate and pray", digerati: "Root cause analysis" },
    { feature: "Vendor coordination", diy: "You manage it", digerati: "Single point of contact" },
    { feature: "Cost visibility", diy: "Surprise invoices", digerati: "Predictable monthly fee" }
  ];

  return (
    <PageTemplate
      layout="chapters"
      eyebrow="Solutions · Voice & meetings"
      title="UCaaS: Voice & Meetings"
      subtitle="We design, secure, and run your phone system and meeting stack so it actually supports the business"
      breadcrumbs={[
        { label: "Solutions", href: "/solutions" },
        { label: "UCaaS" }
      ]}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <HeroActions
            primary={{ label: CTA.primary, href: "/book" }}
            secondary={{ label: "See service & cost", href: "#pricing" }}
          />
        </div>
      }
      heroAside={
        <HeroFacts
          title="Service & cost"
          rows={pricingTiers.map((t) => ({ label: t.type === "one-time" ? "One-time" : "Monthly", value: `${t.name}: ${t.price}` }))}
          footnote="Start with implementation, add ongoing management, or take the full stack."
        />
      }
    >
      <ServiceJsonLd
        name="Unified Communications (UCaaS)"
        description="We design, secure, and run your phone system and meeting stack so it actually supports the business."
        url="/services/ucaas"
      />
      <BreadcrumbJsonLd items={[
        { name: "Home", url: "/" },
        { name: "Solutions", url: "/solutions" },
        { name: "UCaaS", url: "/services/ucaas" }
      ]} />

      <Chapter tone="well">
        <Container>
          <ChapterHeader tone="well" eyebrow="The problem" title="What's broken right now" />
          <IconCards tone="well" columns={4} testPrefix="card-broken" items={brokenItems} />
        </Container>
      </Chapter>

      <Chapter tone="paper">
        <Container>
          <ChapterHeader tone="paper" eyebrow="The cost" title="The hidden bill" />
          <div className="grid gap-10 md:grid-cols-2 lg:gap-14">
            <div>
              <h3 className="mb-5 font-heading text-xl font-semibold text-[#1A1228]">Business impact</h3>
              <CheckList tone="paper" columns={1} items={hiddenBillItems.business} />
            </div>
            <div>
              <h3 className="mb-5 font-heading text-xl font-semibold text-[#1A1228]">Liability & compliance</h3>
              <CheckList tone="paper" columns={1} items={hiddenBillItems.liability} />
            </div>
          </div>
        </Container>
      </Chapter>

      <Chapter tone="surface">
        <Container>
          <ChapterHeader tone="surface" eyebrow="The work" title="What we actually do" />
          <IconCards tone="surface" columns={3} testPrefix="card-service" items={serviceCards} />
        </Container>
      </Chapter>

      <Chapter tone="well" id="pricing" className="scroll-mt-28">
        <Container>
          <ChapterHeader
            tone="well"
            eyebrow="Pricing"
            title="Service & Cost"
            lede="Choose the level of support that fits your business. Start with implementation, add ongoing management, or get the full stack."
          />
          <ul className="grid gap-4 md:grid-cols-3 md:gap-5">
            {pricingTiers.map((tier) => (
              <li
                key={tier.name}
                className={`${cardDark} flex flex-col p-6 md:p-7`}
                data-testid={`card-pricing-${testSlug(tier.name)}`}
              >
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-de-magenta-ink">
                  {tier.type === "one-time" ? "One-Time" : "Monthly"}
                </p>
                <h3 className="mt-2 font-heading text-2xl font-semibold text-white">{tier.name}</h3>
                <p className="mt-2 font-heading text-3xl font-semibold text-white">{tier.price}</p>
                <p className="mt-2 text-sm text-white/70">{tier.description}</p>
                <div className="mt-6 border-t border-[var(--de-hairline)] pt-6">
                  <CheckList tone="well" columns={1} items={tier.features} />
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </Chapter>

      <Chapter tone="paper">
        <Container>
          <ChapterHeader
            tone="paper"
            eyebrow="Compare"
            title="DIY vs Digerati Experts UCaaS"
            lede="See what you're really getting when you partner with us instead of going it alone."
          />
          <div className="overflow-hidden rounded-xl border border-[var(--de-paper-hairline)] bg-white text-sm md:text-base">
            <div className="grid grid-cols-3 border-b border-[var(--de-paper-hairline)] bg-[#F3EEE8] font-semibold">
              <div className="p-3 text-[#3A3448] md:p-4">Feature</div>
              <div className="border-l border-[var(--de-paper-hairline)] p-3 text-center text-[#3A3448] md:p-4">DIY</div>
              <div className="border-l border-[var(--de-paper-hairline)] p-3 text-center text-de-magenta-paper-ink md:p-4">
                Digerati Experts UCaaS
              </div>
            </div>
            {comparisonItems.map((item, index) => (
              <div
                key={item.feature}
                className="grid grid-cols-3 border-b border-[var(--de-paper-hairline)] last:border-b-0"
                data-testid={`row-comparison-${index}`}
              >
                <div className="p-3 font-medium text-[#1A1228] md:p-4">{item.feature}</div>
                <div className="border-l border-[var(--de-paper-hairline)] p-3 text-center text-[#3A3448] md:p-4">{item.diy}</div>
                <div className="border-l border-[var(--de-paper-hairline)] p-3 text-center font-medium text-[#1A1228] md:p-4">
                  {item.digerati}
                </div>
              </div>
            ))}
          </div>
        </Container>
      </Chapter>

      <ClosingCta
        title="Ready to fix your phone system?"
        lede="Book a 15-minute call to discuss your current setup and see if we're a fit."
        primary={{ label: CTA.primary, href: "/book", testId: "button-schedule-call" }}
        phoneTestId="button-call-now"
      />
    </PageTemplate>
  );
}
