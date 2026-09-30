import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MegaMenu } from "@/components/MegaMenu";
import { DigeratiEnhancedFooterSection } from "./sections/DigeratiEnhancedFooterSection";
import { Button } from "@/components/ui/button";
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
  const prefersReducedMotion = useReducedMotion();
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

  const containerVariants = prefersReducedMotion ? undefined : {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = prefersReducedMotion ? undefined : {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <MegaMenu />
      
      <main className="relative z-10 de-nav-clear pb-16">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          {/* Hero */}
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-de-raised border border-de-hairline text-de-magenta-ink text-sm font-medium mb-4">
              <Shield className="w-4 h-4" />
              <span>Security-First IT Bundles</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4" data-testid="heading-ecosystem-pricing">
              Digerati Experts — Service Matrix
            </h1>
            <p className="text-white/60 text-lg max-w-2xl mx-auto mb-6">
              Compare tiers · Explore capabilities · Find your fit
            </p>
            
            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#D3126A]"></span>
                <span className="text-white/60">Included / ✓</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-de-magenta"></span>
                <span className="text-white/60">Premium / Pro</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-white/20"></span>
                <span className="text-white/60">Not included</span>
              </div>
            </div>
          </motion.div>

          {/* Controls */}
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            <Button
              size="sm"
              onClick={() => setHighlightUpgrades(!highlightUpgrades)}
              className={highlightUpgrades 
                ? "bg-de-magenta hover:bg-de-magenta text-white" 
                : "bg-white/10 border border-white/20 text-white hover:bg-white/20"}
              data-testid="btn-highlight-upgrades"
            >
              <Star className="w-4 h-4 mr-2" />
              Highlight upgrades
            </Button>
            <Button
              size="sm"
              onClick={() => setExpandedCategories(serviceCategories.map(c => c.id))}
              className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
              data-testid="btn-expand-all"
            >
              Expand All
            </Button>
            <Button
              size="sm"
              onClick={() => setExpandedCategories([])}
              className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
              data-testid="btn-collapse-all"
            >
              Collapse All
            </Button>
          </div>

          {/* Tier Headers - Sticky */}
          <div className="sticky top-16 z-20 bg-de-bg border-b border-de-hairline mb-6 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            <div className="max-w-[1600px] mx-auto">
              <div className="grid grid-cols-5 gap-2 py-4">
                <div className="text-white/55 text-sm font-medium flex items-center">
                  Capability
                </div>
                {tiers.map((tier, index) => (
                  <div 
                    key={tier.id}
                    className={`text-center p-3 rounded-xl border ${tier.borderColor} bg-de-raised`}
                    data-testid={`tier-header-${tier.id}`}
                  >
                    <div className={`text-xs font-semibold text-de-magenta-ink uppercase tracking-wide mb-1`}>
                      {tier.ribbon}
                    </div>
                    <h3 className="text-white font-bold text-sm md:text-base">{tier.name}</h3>
                    <p className="text-white/50 text-xs">{tier.subtitle}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Service Categories */}
          <motion.div
            className="space-y-4"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {serviceCategories.map((category) => {
              const isExpanded = expandedCategories.includes(category.id);
              
              return (
                <motion.div
                  key={category.id}
                  className="rounded-xl border border-white/10 overflow-hidden"
                  style={{
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))'
                  }}
                  variants={itemVariants}
                  data-testid={`category-${category.id}`}
                >
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
                    data-testid={`btn-toggle-${category.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-de-raised flex items-center justify-center text-de-magenta-ink">
                        {category.icon}
                      </div>
                      <span className="text-white font-bold text-lg">{category.title}</span>
                      <span className="text-white/55 text-sm">({category.rows.length})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-white/55" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-white/55" />
                      )}
                    </div>
                  </button>

                  {/* Category Rows */}
                  {isExpanded && (
                    <div className="border-t border-white/10">
                      {category.rows.map((row, rowIndex) => (
                        <div
                          key={rowIndex}
                          className={`grid grid-cols-5 gap-2 p-3 ${
                            rowIndex % 2 === 0 ? 'bg-white/[0.01]' : 'bg-transparent'
                          } hover:bg-white/[0.03] transition-colors`}
                          data-testid={`row-${category.id}-${rowIndex}`}
                        >
                          <div className="text-white/80 text-sm flex items-center">
                            {row.capability}
                          </div>
                          <div className="text-center flex items-center justify-center">
                            {renderCellValue(row.essentials, 0)}
                          </div>
                          <div className="text-center flex items-center justify-center">
                            {renderCellValue(row.office, 1)}
                          </div>
                          <div className={`text-center flex items-center justify-center ${
                            highlightUpgrades && row.business !== row.office ? 'bg-[#D3126A]/10 rounded-lg' : ''
                          }`}>
                            {renderCellValue(row.business, 2)}
                          </div>
                          <div className={`text-center flex items-center justify-center ${
                            highlightUpgrades && row.enterprise !== row.business ? 'bg-[#D3126A]/10 rounded-lg' : ''
                          }`}>
                            {renderCellValue(row.enterprise, 3)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </motion.div>

          {/* Pricing Note */}
          <motion.div
            className="mt-8 p-6 rounded-xl border border-de-hairline bg-de-raised text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <p className="text-white/50 text-sm mb-4">
              * Pricing shown is per-user/month. Minimum user counts and site fees may apply. 
              Contact us for a custom quote based on your specific requirements.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button asChild variant="brand" data-testid="btn-book-call">
                  <a href="/book">
                    Get My Cyber Risk Assessment
                  </a>
                </Button>
              <Button asChild 
                  variant="outline"
                  className="border-de-hairline bg-transparent text-white hover:bg-de-bg"
                  data-testid="btn-compare-packages"
                >
                  <a href="/proactive-ecosystem-pricing">
                    Compare Packages
                  </a>
                </Button>
            </div>
          </motion.div>
        </div>
      </main>

      <DigeratiEnhancedFooterSection />
    </div>
  );
};

export default EcosystemPricing;
