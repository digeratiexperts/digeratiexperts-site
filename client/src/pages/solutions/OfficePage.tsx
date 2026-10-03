import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MegaMenu } from "@/components/MegaMenu";
import { DigeratiEnhancedFooterSection } from "@/pages/sections/DigeratiEnhancedFooterSection";
import { Button } from "@/components/ui/button";
import { 
  ChevronDown, ChevronUp, Shield, Monitor, Cloud, Key,
  Check, X, Phone, ArrowRight, Users, Building2, Clock,
  FileCheck, HelpCircle, AlertTriangle, Info, Zap
} from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { ServiceJsonLd, BreadcrumbJsonLd } from "@/components/JsonLd";
import { pricing } from "@/data/pricing";
import { CTA } from "@/lib/ctaCopy";
import { PRIMARY_PHONE } from "@/data/companyContact";

type InclusionStatus = "included" | "limited" | "optional" | "not-included";

interface MatrixRow {
  id: string;
  capability: string;
  status: InclusionStatus;
  tooltip?: string;
}

interface MatrixCategory {
  id: string;
  title: string;
  icon: React.ReactNode;
  rows: MatrixRow[];
}

const officeRecommendedBullets = [
  { id: "service-desk", label: "Service Desk + Ticketing", mapTo: "service-desk" },
  { id: "email-mfa", label: "MFA + SSO + Password Manager", mapTo: "mfa" },
  { id: "edr", label: "Endpoint Security (EDR)", mapTo: "edr" },
  { id: "email-protection", label: "Email Protection (Anti-Phishing)", mapTo: "email-protection" },
  { id: "network", label: "Managed Network & Connectivity", mapTo: "network-health" },
  { id: "backup", label: "Backup Strategy + Restore Support", mapTo: "backup-strategy" }
];

const matrixCategories: MatrixCategory[] = [
  {
    id: "managed-it",
    title: "Managed IT",
    icon: <Monitor className="w-5 h-5" />,
    rows: [
      { id: "service-desk", capability: "Service Desk (remote support + ticketing)", status: "limited", tooltip: "Business hours coverage; priority response is add-on" },
      { id: "support-hours", capability: "Support hours (SLA)", status: "limited", tooltip: "8×5 business hours; after-hours is add-on" },
      { id: "monitoring", capability: "Device monitoring & alerting", status: "included" },
      { id: "patching", capability: "OS & third-party patching", status: "included" },
      { id: "onboarding", capability: "New user onboarding (accounts + access)", status: "limited", tooltip: "Standard workflow; complex app roles may be add-on" },
      { id: "offboarding", capability: "User offboarding (disable access, secure handoff)", status: "limited", tooltip: "Standard workflow; complex handoffs may be add-on" },
      { id: "device-setup", capability: "Device setup guidance (standard baseline)", status: "limited", tooltip: "Remote guidance; on-site setup is add-on" },
      { id: "documentation", capability: "Documentation (network + key systems)", status: "included" },
      { id: "asset-inventory", capability: "Asset inventory (devices + key systems)", status: "included" },
      { id: "reporting", capability: "Executive reporting", status: "limited", tooltip: "Semi-annual review included" },
      { id: "vcio", capability: "vCIO / planning session", status: "limited", tooltip: "Semi-annual strategy session included" }
    ]
  },
  {
    id: "security",
    title: "Security Baseline",
    icon: <Shield className="w-5 h-5" />,
    rows: [
      { id: "security-baseline", capability: "Security baseline policies (device + account)", status: "included" },
      { id: "edr", capability: "Endpoint threat protection (EDR)", status: "included" },
      { id: "email-protection", capability: "Email protection (anti-phishing)", status: "included" },
      { id: "dns", capability: "DNS / web protection", status: "included" },
      { id: "awareness", capability: "Security awareness baseline (guidance + templates)", status: "limited", tooltip: "Baseline training materials; interactive simulations are add-on" },
      { id: "vuln-scan", capability: "Vulnerability scan (external / basic)", status: "limited", tooltip: "Quarterly snapshot; remediation planning included" },
      { id: "ir-readiness", capability: "Incident response readiness (basic plan + contacts)", status: "limited", tooltip: "Basic playbook; full IR retainer is add-on" },
      { id: "soc", capability: "Advanced monitoring / SOC response", status: "optional", tooltip: "24/7 SOC monitoring available as add-on" },
      { id: "compliance", capability: "Compliance frameworks & reporting", status: "optional", tooltip: "HIPAA, SOC 2, CMMC modules available" }
    ]
  },
  {
    id: "identity",
    title: "Identity & Access",
    icon: <Key className="w-5 h-5" />,
    rows: [
      { id: "mfa", capability: "Secure login (MFA enforced)", status: "included" },
      { id: "sso", capability: "Single Sign-On (SSO) for core apps", status: "limited", tooltip: "Core apps supported; large app catalogs may be add-on" },
      { id: "password-manager", capability: "Password manager (managed)", status: "included" },
      { id: "lifecycle", capability: "Account lifecycle (joiner/mover/leaver)", status: "limited", tooltip: "Standard workflows; complex role changes may be add-on" },
      { id: "conditional-access", capability: "Conditional access (basic rules)", status: "limited", tooltip: "Baseline rules (location/device risk); advanced policy sets are add-on" },
      { id: "access-reviews", capability: "Access reviews / audit exports", status: "limited", tooltip: "Quarterly exports included; continuous monitoring is add-on" },
      { id: "pam", capability: "Privileged access management", status: "optional", tooltip: "PAM available as add-on for sensitive environments" }
    ]
  },
  {
    id: "backup",
    title: "Cloud, Backup & Recovery",
    icon: <Cloud className="w-5 h-5" />,
    rows: [
      { id: "backup-strategy", capability: "Backup strategy & scope definition", status: "included" },
      { id: "endpoint-backup", capability: "Endpoint backup (workstations)", status: "limited", tooltip: "Standard retention; extended retention is add-on" },
      { id: "cloud-backup", capability: "Cloud productivity data protection (email/files)", status: "limited", tooltip: "Core data protected; advanced archiving is add-on" },
      { id: "restore-support", capability: "Restore support (file/user restores)", status: "limited", tooltip: "Standard restore requests included" },
      { id: "restore-testing", capability: "Verified restore testing", status: "limited", tooltip: "Quarterly test of sample restore; full DR test is add-on" },
      { id: "server-backup", capability: "Server/VM backup", status: "optional", tooltip: "Available as add-on" },
      { id: "draas", capability: "Disaster recovery / warm standby", status: "optional", tooltip: "DRaaS available for critical systems" },
      { id: "rpo-rto", capability: "Agreed RPO/RTO targets", status: "optional", tooltip: "Contract-defined recovery targets available as add-on" }
    ]
  }
];

const shortCompareRows = [
  { label: "Support hours (SLA)", value: "8×5 business hours" },
  { label: "Response targets", value: "Standard (next business day)" },
  { label: "Patch + monitoring coverage", value: "Full coverage" },
  { label: "Email protection level", value: "Anti-phishing gateway" },
  { label: "Endpoint protection level", value: "EDR (detect + respond)" },
  { label: "Backup scope", value: "Endpoint + cloud data" },
  { label: "Restore testing cadence", value: "Quarterly" },
  { label: "Vulnerability scan cadence", value: "Quarterly" },
  { label: "Identity controls", value: "MFA + SSO + Password Manager" },
  { label: "Planning/reporting cadence", value: "Semi-annual" }
];

const notIncludedItems = [
  { item: "MDR / 24×7 SOC monitoring", reason: "Available as add-on for organizations needing continuous threat hunting" },
  { item: "Continuous vulnerability management", reason: "Quarterly scans included; continuous scanning is add-on" },
  { item: "Disaster Recovery (DRaaS) / warm standby", reason: "Available as add-on for critical systems requiring rapid failover" },
  { item: "Privileged Access Management (PAM)", reason: "Available as add-on for environments with elevated access requirements" },
  { item: "Advanced compliance reporting (HIPAA, SOC 2)", reason: "Compliance modules available as add-on" },
  { item: "On-site support", reason: "Per-incident on-site visits available; scheduled on-site is Business tier" }
];

const faqs = [
  {
    question: "What size organization is Office designed for?",
    answer: "Office is designed for small offices with 5–25 users who don't have internal IT staff. It provides a complete IT foundation with one predictable monthly price—no surprise costs."
  },
  {
    question: "What's the minimum commitment?",
    answer: "Office requires a minimum of 5 users. This ensures we can provide meaningful coverage and justify the infrastructure investment for your organization."
  },
  {
    question: "What does 'Included (Limited)' mean?",
    answer: "It means the capability is included within defined parameters. For example, support hours are included during business hours (8×5), and restore testing is included quarterly. The tooltip explains each limit."
  },
  {
    question: "Can I add capabilities not included in Office?",
    answer: "Yes. Items marked 'Optional Add-On' (like SOC monitoring, DRaaS, or compliance modules) can be added to your Office package. We'll quote these separately based on your needs."
  },
  {
    question: "How does pricing work?",
    answer: "Office is priced per user per month with a 5-user minimum. The per-user price includes all 'Included' and 'Included (Limited)' capabilities. Add-ons are quoted separately."
  },
  {
    question: "What's the difference between Office and Business?",
    answer: "Business adds priority response, monthly restore testing, advanced security training, quarterly access reviews, and optional on-site support. It's designed for organizations with higher uptime or compliance requirements."
  }
];

function StatusBadge({ status, tooltip }: { status: InclusionStatus; tooltip?: string }) {
  const [showTooltip, setShowTooltip] = useState(false);
  
  const config = {
    "included": { 
      bg: "bg-de-raised", 
      text: "text-de-accent-ink", 
      border: "border-de-hairline",
      label: "Included",
      icon: <Check className="w-3 h-3" />
    },
    "limited": { 
      bg: "bg-de-raised", 
      text: "text-de-accent-ink", 
      border: "border-de-hairline",
      label: "Included",
      icon: <Info className="w-3 h-3" />
    },
    "optional": { 
      bg: "bg-de-raised", 
      text: "text-white/70", 
      border: "border-de-hairline",
      label: "Add-On",
      icon: <Zap className="w-3 h-3" />
    },
    "not-included": { 
      bg: "bg-white/5", 
      text: "text-white/55", 
      border: "border-white/10",
      label: "—",
      icon: null
    }
  };

  const { bg, text, border, label, icon } = config[status];

  return (
    <div className="relative inline-block">
      <span 
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${bg} ${text} border ${border} cursor-default`}
        onMouseEnter={() => tooltip && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {icon}
        {label}
        {tooltip && <Info className="w-3 h-3 ml-0.5 opacity-60" />}
      </span>
      {showTooltip && tooltip && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 border border-white/20 rounded-lg text-xs text-white/80 whitespace-nowrap max-w-xs text-center shadow-xl">
          {tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-gray-900 border-r border-b border-white/20 transform rotate-45" />
        </div>
      )}
    </div>
  );
}

function FAQItem({ question, answer, isOpen, onToggle, index }: { 
  question: string; 
  answer: string; 
  isOpen: boolean; 
  onToggle: () => void; 
  index: number 
}) {
  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-white/5 transition-colors"
        aria-expanded={isOpen}
        data-testid={`faq-toggle-${index}`}
      >
        <span className="font-semibold text-white pr-4">{question}</span>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-de-accent-ink flex-shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-de-accent-ink flex-shrink-0" />
        )}
      </button>
      {isOpen && (
        <div className="px-5 pb-5 text-white/70 leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  );
}

function StickyCTA() {
  return (
    <div className="border-t border-white/10 bg-gray-950/80">
      <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-de-accent-ink" />
          <span className="text-white font-medium">Office Package</span>
          <span className="text-white/60 text-sm hidden sm:inline">Complete IT for small offices (5–25 users)</span>
        </div>
        <div className="flex items-center gap-3">
          <Button
            asChild
            size="sm"
            className="bg-transparent border border-white/20 text-white hover:bg-white/10"
            data-testid="btn-sticky-pricing"
          >
            <a href="#package">Get Pricing</a>
          </Button>
          <Button
            asChild
            size="sm"
            variant="brand"
            className="font-semibold"
            data-testid="btn-sticky-consultation"
          >
            <a href="/book">
              {CTA.primary}
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function OfficePage() {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [showFullMatrix, setShowFullMatrix] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(matrixCategories.map(c => c.id));
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showNotIncluded, setShowNotIncluded] = useState(false);

  useSEO({
    title: "Office Package - Complete IT for Small Offices | Digerati Experts",
    description: "One predictable monthly price for small offices (5–25 users) with no internal IT. Includes help desk, security baseline, identity management, and backup—all managed for you.",
    canonical: "/solutions/ProActive-Ecosystem-Packages"
  });

  const fadeInUp = prefersReducedMotion ? {} : {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.5 }
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-hidden">
      <ServiceJsonLd
        name="ProActive Ecosystem - Office Package"
        description="One predictable monthly price for small offices (5-25 users) with no internal IT. Includes help desk, security baseline, identity management, and backup."
        url="/solutions/ProActive-Ecosystem-Packages"
      />
      <BreadcrumbJsonLd items={[
        { name: "Home", url: "/" },
        { name: "Solutions", url: "/solutions" },
        { name: "Office Package", url: "/solutions/ProActive-Ecosystem-Packages" }
      ]} />
      <MegaMenu />
      
      <main id="main-content" tabIndex={-1} className="relative de-nav-clear pb-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
          
          {/* Hero Section */}
          <motion.section {...fadeInUp} className="relative">
            <div className="absolute inset-0 bg-de-raised to-transparent rounded-3xl pointer-events-none" />
            <div className="relative bg-white/[0.02] border border-white/10 rounded-3xl p-8 md:p-12">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-de-raised border border-de-hairline text-de-accent-ink text-sm font-medium mb-6">
                  <Shield className="w-4 h-4" />
                  Fit for small offices
                </div>
                
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
                  Office
                  <span className="block text-2xl md:text-3xl font-normal text-white/70 mt-2">
                    Complete IT for small offices—one predictable price
                  </span>
                </h1>
                
                <p className="text-lg text-white/70 mb-8 leading-relaxed">
                  Designed for organizations with 5–25 users and no internal IT staff. 
                  Help desk, security baseline, identity management, and backup—all managed for you.
                </p>

                <div className="flex flex-wrap gap-4 mb-8">
                  <Button
                    asChild
                    size="lg"
                    className="bg-white text-de-accent hover:bg-de-paper-raised font-semibold shadow-lg"
                    data-testid="btn-hero-consultation"
                  >
                    <a href="/book">
                      {CTA.primary}
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </motion.section>

          {/* Who It's For + Outcomes */}
          <motion.section {...fadeInUp}>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-4">Who Office Is For</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-de-raised flex items-center justify-center">
                    <Users className="w-5 h-5 text-de-accent-ink" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">Your Organization</h3>
                </div>
                <ul className="space-y-3 text-white/70">
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-de-accent-ink flex-shrink-0 mt-0.5" />
                    <span>5–25 users (minimum 5)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-de-accent-ink flex-shrink-0 mt-0.5" />
                    <span>No internal IT staff or part-time IT stretched thin</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-de-accent-ink flex-shrink-0 mt-0.5" />
                    <span>Need reliable help desk without hourly billing surprises</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-de-accent-ink flex-shrink-0 mt-0.5" />
                    <span>Want security basics handled without becoming an expert</span>
                  </li>
                </ul>
              </div>
              <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-de-raised flex items-center justify-center">
                    <FileCheck className="w-5 h-5 text-de-accent-ink" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">Outcomes You Get</h3>
                </div>
                <ul className="space-y-3 text-white/70">
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-de-accent-ink flex-shrink-0 mt-0.5" />
                    <span>One monthly price—no surprise invoices</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-de-accent-ink flex-shrink-0 mt-0.5" />
                    <span>Issues resolved without you managing the fix</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-de-accent-ink flex-shrink-0 mt-0.5" />
                    <span>Security baseline for identity, endpoints, and email</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-de-accent-ink flex-shrink-0 mt-0.5" />
                    <span>Backup + restore that's tested, not assumed</span>
                  </li>
                </ul>
              </div>
            </div>
          </motion.section>

          {/* What's Included (Deliverables) */}
          <motion.section {...fadeInUp}>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-4">What's Included</h2>
              <p className="text-white/60">Every Office package includes these core capabilities</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {officeRecommendedBullets.map((bullet, index) => (
                <motion.div
                  key={bullet.id}
                  {...fadeInUp}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-3 bg-white/[0.03] border border-white/10 rounded-xl p-4"
                >
                  <div className="w-8 h-8 rounded-full bg-de-raised flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-de-accent-ink" />
                  </div>
                  <span className="text-white font-medium">{bullet.label}</span>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* Package Card */}
          <motion.section {...fadeInUp} id="package" className="scroll-mt-32">
            <div className="max-w-lg mx-auto">
              <div className="relative bg-de-raised to-transparent rounded-2xl border-2 border-de-hairline overflow-hidden">
                <div className="absolute top-0 left-0 right-0 bg-de-accent text-white text-center text-sm py-1.5 font-medium">
                  Small-office operating model
                </div>
                <div className="p-8 pt-12">
                  <h3 className="text-3xl font-bold text-white mb-2">Office</h3>
                  <p className="text-white/60 mb-6">Complete IT foundation for 5–25 users</p>
                  
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-white">${pricing.office.user}</span>
                      <span className="text-white/60">/user/month</span>
                    </div>
                    <p className="text-white/50 text-sm mt-1">${pricing.office.monthlyMinimum.toLocaleString()}/mo minimum</p>
                  </div>

                  <div className="space-y-3 mb-6">
                    <p className="text-white/80 font-medium text-sm">Includes:</p>
                    {officeRecommendedBullets.map((bullet) => (
                      <div key={bullet.id} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-de-accent-ink flex-shrink-0 mt-0.5" />
                        <span className="text-white/80 text-sm">{bullet.label}</span>
                      </div>
                    ))}
                  </div>

                  <Button
                    asChild
                    variant="brand"
                    className="w-full font-semibold"
                    size="lg"
                    data-testid="btn-package-consultation"
                  >
                    <a href="/book">
                      {CTA.primary}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </motion.section>

          {/* Short Compare */}
          <motion.section {...fadeInUp}>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-4">Office at a Glance</h2>
              <p className="text-white/60">Quick overview of what's covered</p>
            </div>
            <div className="bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden">
              <div className="divide-y divide-white/10">
                {shortCompareRows.map((row, index) => (
                  <div 
                    key={index} 
                    className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02]"
                  >
                    <span className="text-white/80">{row.label}</span>
                    <span className="text-de-accent-ink font-medium">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="text-center mt-6">
              <Button
                onClick={() => setShowFullMatrix(!showFullMatrix)}
                className="bg-transparent border border-white/20 text-white hover:bg-white/10"
                data-testid="btn-toggle-matrix"
              >
                {showFullMatrix ? "Hide" : "View"} Full Service Matrix
                {showFullMatrix ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
              </Button>
            </div>
          </motion.section>

          {/* Full Matrix (Expandable) */}
          {showFullMatrix && (
            <motion.section 
              {...fadeInUp}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="space-y-4">
                {matrixCategories.map((category) => (
                  <div 
                    key={category.id}
                    className="bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden"
                  >
                    <button
                      onClick={() => toggleCategory(category.id)}
                      className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/[0.03] transition-colors"
                      data-testid={`category-toggle-${category.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-de-raised flex items-center justify-center text-de-accent-ink">
                          {category.icon}
                        </div>
                        <span className="font-semibold text-white">{category.title}</span>
                        <span className="text-white/55 text-sm">({category.rows.length} items)</span>
                      </div>
                      {expandedCategories.includes(category.id) ? (
                        <ChevronUp className="w-5 h-5 text-white/55" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-white/55" />
                      )}
                    </button>
                    
                    {expandedCategories.includes(category.id) && (
                      <div className="border-t border-white/10">
                        {category.rows.map((row, rowIndex) => (
                          <div 
                            key={row.id}
                            className={`flex items-center justify-between px-6 py-3 ${
                              rowIndex < category.rows.length - 1 ? 'border-b border-white/5' : ''
                            } hover:bg-white/[0.02]`}
                          >
                            <span className="text-white/70 text-sm">{row.capability}</span>
                            <StatusBadge status={row.status} tooltip={row.tooltip} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.section>
          )}

          {/* What's Not Included */}
          <motion.section {...fadeInUp}>
            <div className="bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowNotIncluded(!showNotIncluded)}
                className="w-full flex items-center justify-between px-6 py-5 hover:bg-white/[0.03] transition-colors"
                data-testid="btn-not-included-toggle"
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-de-accent-ink" />
                  <span className="font-semibold text-white">What's Not Included in Office</span>
                  <span className="text-white/55 text-sm">(prevents scope questions)</span>
                </div>
                {showNotIncluded ? (
                  <ChevronUp className="w-5 h-5 text-white/55" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-white/55" />
                )}
              </button>
              
              {showNotIncluded && (
                <div className="border-t border-white/10 p-6 space-y-4">
                  {notIncludedItems.map((item, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <X className="w-5 h-5 text-white/55 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-white font-medium">{item.item}</p>
                        <p className="text-white/50 text-sm">{item.reason}</p>
                      </div>
                    </div>
                  ))}
                  <p className="text-white/50 text-sm pt-4 border-t border-white/10">
                    These capabilities are available as add-ons or included in higher tiers (Business, Enterprise).
                  </p>
                </div>
              )}
            </div>
          </motion.section>

          {/* FAQs */}
          <motion.section {...fadeInUp}>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-4">Frequently Asked Questions</h2>
            </div>
            <div className="max-w-3xl mx-auto space-y-3">
              {faqs.map((faq, index) => (
                <FAQItem
                  key={index}
                  index={index}
                  question={faq.question}
                  answer={faq.answer}
                  isOpen={openFaq === index}
                  onToggle={() => setOpenFaq(openFaq === index ? null : index)}
                />
              ))}
            </div>
          </motion.section>

          {/* Final CTA */}
          <motion.section {...fadeInUp}>
            <div className="relative rounded-2xl overflow-hidden">
              <div className="absolute inset-0 bg-de-raised opacity-90" />
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] pointer-events-none" />
              <div className="relative py-16 px-8 text-center">
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                  Ready for IT That Just Works?
                </h2>
                <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">
                  Schedule a consultation. We'll review your environment and prepare a quote.
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  <Button
                    asChild
                    size="lg"
                    className="bg-white text-de-accent hover:bg-de-paper-raised font-semibold shadow-lg"
                    data-testid="btn-final-consultation"
                  >
                    <a href="/book">
                      {CTA.primary}
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </a>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    className="bg-transparent border border-white/30 text-white hover:bg-white/10"
                    data-testid="btn-final-call"
                  >
                    <a href={PRIMARY_PHONE.telHref}>
                      <Phone className="mr-2 h-5 w-5" />
                      Call {PRIMARY_PHONE.display}
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </motion.section>
        </div>
      </main>

      <StickyCTA />
      <DigeratiEnhancedFooterSection />
    </div>
  );
}
