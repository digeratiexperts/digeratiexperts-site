import { useState } from "react";
import { PageTemplate } from "@/components/PageTemplate";
import { Chapter, Container, ClosingCta, HeroActions, cardDark, buttonSecondary } from "@/components/site/chapters";
import { cn } from "@/lib/utils";
import { 
  ChevronDown, ChevronUp, Shield, Server, Users, 
  Monitor, Cloud, Key, Settings, HardDrive,
  FileCheck, Building2, Check, X, Star, Zap
} from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { pricing } from "@/data/pricing";

interface ServiceRow {
  capability: string;
  essentials: string | boolean;
  office: string | boolean;
  business: string | boolean;
  enterprise: string | boolean;
}

interface ServiceCategory {
  id: string;
  title: string;
  icon: React.ReactNode;
  rows: ServiceRow[];
}

const serviceCategories: ServiceCategory[] = [
  {
    id: "managed-it",
    title: "Managed IT",
    icon: <Monitor className="w-5 h-5" />,
    rows: [
      { capability: "Help Desk & SLA", essentials: false, office: "8×5", business: "8×5 + Priority", enterprise: "VIP + 24×7 opt" },
      { capability: "Remote Monitoring & Alerting", essentials: true, office: true, business: true, enterprise: true },
      { capability: "Patch & App Management", essentials: true, office: true, business: true, enterprise: true },
      { capability: "Remote Support & Quick Assist", essentials: false, office: true, business: true, enterprise: true },
      { capability: "IT Documentation & Knowledge Base", essentials: false, office: "Standard", business: "Comprehensive", enterprise: "Full + Client access" },
      { capability: "Client Portal & Ticketing", essentials: false, office: true, business: true, enterprise: true },
      { capability: "Asset & Warranty", essentials: false, office: "Basic", business: "Full", enterprise: "Lifecycle + budgeting" },
      { capability: "Executive Reporting & QBRs", essentials: false, office: "Semi-annual", business: "Quarterly", enterprise: "Monthly" },
      { capability: "IT Governance & Roadmaps", essentials: false, office: false, business: false, enterprise: "Included" },
      { capability: "vCIO", essentials: false, office: "Semi-annual", business: "Quarterly", enterprise: "Monthly" },
    ]
  },
  {
    id: "cybersecurity",
    title: "Cybersecurity",
    icon: <Shield className="w-5 h-5" />,
    rows: [
      { capability: "Baseline Threat Protection", essentials: true, office: true, business: true, enterprise: true },
      { capability: "Data Safeguards & Identity Controls", essentials: true, office: true, business: true, enterprise: true },
      { capability: "Email Security & MFA", essentials: "Managed baseline", office: "Advanced protection", business: "Enhanced", enterprise: "Advanced + SSO" },
      { capability: "Endpoint Detection & Response", essentials: "Managed baseline", office: "EDR + 24/7 MDR", business: "Enhanced EDR + 24/7 MDR", enterprise: "Advanced EDR + MDR" },
      { capability: "Security Awareness & Phishing", essentials: "Included baseline", office: "Training + simulations", business: "Enhanced + simulations", enterprise: "Role-based + simulations" },
      { capability: "SaaS App Security Monitoring", essentials: false, office: "Optional", business: true, enterprise: true },
      { capability: "Dark Web Monitoring", essentials: false, office: true, business: true, enterprise: true },
      { capability: "DNS Filtering & Web Gateway", essentials: false, office: true, business: true, enterprise: true },
      { capability: "Vulnerability Scanning", essentials: false, office: "Quarterly", business: "Monthly", enterprise: "Continuous" },
      { capability: "Incident Response Plan", essentials: false, office: false, business: "Template", enterprise: "Custom + tabletop" },
    ]
  },
  {
    id: "cloud-backup",
    title: "Cloud & Backup",
    icon: <Cloud className="w-5 h-5" />,
    rows: [
      { capability: "Endpoint Backup", essentials: false, office: true, business: true, enterprise: true },
      { capability: "SaaS Backup (M365/Google)", essentials: false, office: true, business: true, enterprise: true },
      { capability: "Server/VM Backup", essentials: false, office: "Optional", business: true, enterprise: true },
      { capability: "Immutable Backup Copies", essentials: false, office: false, business: true, enterprise: true },
      { capability: "Verified Restore Testing", essentials: false, office: "Quarterly", business: "Monthly", enterprise: "Weekly" },
      { capability: "Disaster Recovery (DRaaS)", essentials: false, office: "Optional", business: "Optional", enterprise: true },
      { capability: "Agreed RPO/RTO targets", essentials: false, office: false, business: "Standard", enterprise: "Custom SLA" },
    ]
  },
  {
    id: "identity",
    title: "Identity & Access",
    icon: <Key className="w-5 h-5" />,
    rows: [
      { capability: "Cloud Directory & SSO", essentials: false, office: true, business: true, enterprise: true },
      { capability: "Multi-Factor Authentication", essentials: false, office: true, business: true, enterprise: true },
      { capability: "Conditional Access Policies", essentials: false, office: "Basic", business: "Advanced", enterprise: "Zero Trust" },
      { capability: "User Lifecycle Automation", essentials: false, office: false, business: true, enterprise: true },
      { capability: "Privileged Access Management", essentials: false, office: false, business: "Optional", enterprise: true },
      { capability: "Access Reviews & Auditing", essentials: false, office: false, business: "Quarterly", enterprise: "Continuous" },
    ]
  },
  {
    id: "site-services",
    title: "Site Services",
    icon: <Building2 className="w-5 h-5" />,
    rows: [
      { capability: "Network Design & Management", essentials: false, office: false, business: "Consultation", enterprise: true },
      { capability: "Firewall & SD-WAN", essentials: false, office: false, business: "Optional", enterprise: true },
      { capability: "Wi-Fi Management", essentials: false, office: false, business: "Optional", enterprise: true },
      { capability: "On-Site Support", essentials: false, office: "Per incident", business: "Scheduled", enterprise: "Priority dispatch" },
      { capability: "Hardware Procurement", essentials: false, office: "Assisted", business: "Managed", enterprise: "Full lifecycle" },
      { capability: "Printer & Peripheral Support", essentials: false, office: "Basic", business: true, enterprise: true },
    ]
  },
  {
    id: "add-ons",
    title: "Available Add-Ons",
    icon: <Zap className="w-5 h-5" />,
    rows: [
      { capability: "UCaaS / VoIP Telephony", essentials: "Add-on", office: "Add-on", business: "Add-on", enterprise: "Add-on" },
      { capability: "Compliance Modules (HIPAA, SOC 2)", essentials: "Add-on", office: "Add-on", business: "Add-on", enterprise: "Included" },
      { capability: "Extended Retention & Archiving", essentials: "Add-on", office: "Add-on", business: "Add-on", enterprise: "Add-on" },
      { capability: "Penetration Testing", essentials: "Add-on", office: "Add-on", business: "Add-on", enterprise: "Annual included" },
      { capability: "24/7 SOC Monitoring", essentials: "Add-on", office: true, business: true, enterprise: true },
    ]
  }
];

const tiers = [
  { 
    id: "essentials", 
    name: "ProActive IT", 
    subtitle: `Starting at $${pricing.it.user} /user·mo*`,
    ribbon: "Entry",
    gradient: "from-slate-500 to-gray-600",
    borderColor: "border-slate-500/30"
  },
  { 
    id: "office", 
    name: "ProActive Office", 
    subtitle: `Starting at $${pricing.office.user} /user·mo*`,
    ribbon: "Foundation",
    gradient: " ",
    borderColor: "border-de-hairline"
  },
  { 
    id: "business", 
    name: "ProActive Business", 
    subtitle: `Starting at $${pricing.business.user} /user·mo*`,
    ribbon: "Operations",
    gradient: "",
    borderColor: "border-de-hairline"
  },
  { 
    id: "enterprise", 
    name: "ProActive Enterprise", 
    subtitle: `Starting at $${pricing.enterprise.user} /user·mo*`,
    ribbon: "Custom",
    gradient: "",
    borderColor: "border-de-hairline"
  }
];

const EcosystemPricing = () => {
  const [expandedCategories, setExpandedCategories] = useState<string[]>(
    serviceCategories.map(c => c.id)
  );
  const [highlightUpgrades, setHighlightUpgrades] = useState(false);

  useSEO({
    title: 'Ecosystem Pricing - Digerati Experts Service Matrix',
    description: 'Compare Digerati Experts managed IT service tiers. ProActive IT, Office, Business, and Enterprise packages with detailed feature comparison.',
    canonical: '/ecosystem-pricing',
  });

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const renderCellValue = (value: string | boolean, tierIndex: number) => {
    if (value === true) {
      return (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-de-hairline bg-de-bg text-de-accent-ink">
          <Check className="w-4 h-4" />
        </span>
      );
    }
    if (value === false) {
      return (
        <span className="text-white/55">—</span>
      );
    }
    if (value === "Add-on") {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-de-raised text-white/70 border border-de-hairline">
          Add-on
        </span>
      );
    }
    if (value === "Optional") {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-de-raised text-de-magenta-ink border border-de-hairline">
          Optional
        </span>
      );
    }
    // String value - show as pill
    const isPro = tierIndex >= 2;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
        isPro 
          ? 'bg-de-bg text-white border border-de-hairline' 
          : 'bg-de-raised text-de-magenta-ink border border-de-hairline'
      }`}>
        {value}
      </span>
    );
  };

  const ctrl =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899]";
  const ctrlIdle = "border-de-hairline bg-de-raised text-white hover:border-white/30";

  return (
    <PageTemplate
      layout="chapters"
      eyebrow="Security-First IT Bundles"
      title="Digerati Experts — Service Matrix"
      subtitle="Compare tiers · Explore capabilities · Find your fit"
      showBackButton={false}
      actions={
        <div data-testid="heading-ecosystem-pricing">
          <div className="flex flex-col gap-3 sm:flex-row">
            <HeroActions
              primary={{ label: "Get My Cyber Risk Assessment", href: "/book" }}
              secondary={{ label: "Compare Packages", href: "/proactive-ecosystem-pricing" }}
            />
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/70" aria-label="Legend">
            <li className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#D3126A]" aria-hidden="true" />
              Included / ✓
            </li>
            <li className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-de-magenta" aria-hidden="true" />
              Premium / Pro
            </li>
            <li className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-white/25" aria-hidden="true" />
              Not included
            </li>
          </ul>
        </div>
      }
    >
      <Chapter tone="well" seam={false}>
        <Container>
          <div className="mb-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setHighlightUpgrades(!highlightUpgrades)}
              aria-pressed={highlightUpgrades}
              className={cn(ctrl, highlightUpgrades ? "border-[#D3126A] bg-[#D3126A] text-white" : ctrlIdle)}
              data-testid="btn-highlight-upgrades"
            >
              <Star className="h-4 w-4" aria-hidden="true" />
              Highlight upgrades
            </button>
            <button
              type="button"
              onClick={() => setExpandedCategories(serviceCategories.map((c) => c.id))}
              className={cn(ctrl, ctrlIdle)}
              data-testid="btn-expand-all"
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={() => setExpandedCategories([])}
              className={cn(ctrl, ctrlIdle)}
              data-testid="btn-collapse-all"
            >
              Collapse All
            </button>
          </div>

          {/* Tier headers — sticky */}
          <div className="sticky top-16 z-20 mb-6 border-b border-de-hairline bg-[var(--de-bg)]">
            <div className="grid grid-cols-5 gap-2 py-4">
              <div className="flex items-center text-sm font-medium text-white/65">Capability</div>
              {tiers.map((tier) => (
                <div
                  key={tier.id}
                  className={`rounded-xl border p-3 text-center ${tier.borderColor} bg-de-raised`}
                  data-testid={`tier-header-${tier.id}`}
                >
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-de-magenta-ink">{tier.ribbon}</div>
                  <h2 className="text-sm font-bold text-white md:text-base">{tier.name}</h2>
                  <p className="text-xs text-white/65">{tier.subtitle}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {serviceCategories.map((category) => {
              const isExpanded = expandedCategories.includes(category.id);
              return (
                <div key={category.id} className={cn(cardDark, "overflow-hidden")} data-testid={`category-${category.id}`}>
                  <button
                    type="button"
                    onClick={() => toggleCategory(category.id)}
                    aria-expanded={isExpanded}
                    className="flex min-h-14 w-full items-center justify-between p-4 text-left transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ec4899]"
                    data-testid={`btn-toggle-${category.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-de-bg text-de-magenta-ink">
                        {category.icon}
                      </div>
                      <span className="font-heading text-lg font-semibold text-white">{category.title}</span>
                      <span className="text-sm text-white/65">({category.rows.length})</span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-white/65" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-white/65" aria-hidden="true" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-[var(--de-hairline)]">
                      {category.rows.map((row, rowIndex) => (
                        <div
                          key={rowIndex}
                          className="grid grid-cols-5 gap-2 border-t border-[var(--de-hairline)] p-3 first:border-t-0 hover:bg-white/[0.03]"
                          data-testid={`row-${category.id}-${rowIndex}`}
                        >
                          <div className="flex items-center text-sm text-white/85">{row.capability}</div>
                          <div className="flex items-center justify-center text-center">{renderCellValue(row.essentials, 0)}</div>
                          <div className="flex items-center justify-center text-center">{renderCellValue(row.office, 1)}</div>
                          <div
                            className={`flex items-center justify-center text-center ${
                              highlightUpgrades && row.business !== row.office ? "rounded-lg bg-[#D3126A]/15" : ""
                            }`}
                          >
                            {renderCellValue(row.business, 2)}
                          </div>
                          <div
                            className={`flex items-center justify-center text-center ${
                              highlightUpgrades && row.enterprise !== row.business ? "rounded-lg bg-[#D3126A]/15" : ""
                            }`}
                          >
                            {renderCellValue(row.enterprise, 3)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Container>
      </Chapter>

      <ClosingCta
        tone="surface"
        eyebrow="Pricing note"
        title="Find the fit, then confirm the price"
        lede="* Pricing shown is per-user/month. Minimum user counts and site fees may apply. Contact us for a custom quote based on your specific requirements."
        primary={{ label: "Get My Cyber Risk Assessment", href: "/book", testId: "btn-book-call" }}
        secondary={{ label: "Compare Packages", href: "/proactive-ecosystem-pricing", testId: "btn-compare-packages" }}
      />
    </PageTemplate>
  );
};

export default EcosystemPricing;
