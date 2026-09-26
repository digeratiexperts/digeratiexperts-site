import { motion, useReducedMotion } from "framer-motion";
import { Check, ChevronRight } from "lucide-react";
import { Link } from "wouter";

type TierValue = string | boolean;

interface CapabilityRow {
  capability: string;
  essentials: TierValue;
  office: TierValue;
  business: TierValue;
  enterprise: TierValue;
}

interface CategoryData {
  id: string;
  title: string;
  rows: CapabilityRow[];
}

const allCategories: CategoryData[] = [
  {
    id: "managed-it",
    title: "Managed IT",
    rows: [
      { capability: "Help Desk & SLA", essentials: false, office: "8×5", business: "8×5 + Priority", enterprise: "VIP + 24×7 opt" },
      { capability: "Remote Monitoring & Alerting", essentials: true, office: true, business: true, enterprise: true },
      { capability: "Patch & App Management", essentials: true, office: true, business: true, enterprise: true },
      { capability: "Remote Support & Quick Assist", essentials: false, office: true, business: true, enterprise: true },
      { capability: "IT Documentation & Knowledge Base", essentials: false, office: "Standard", business: "Comprehensive", enterprise: "Full + Client access" },
      { capability: "Client Portal & Ticketing", essentials: false, office: true, business: true, enterprise: true },
      { capability: "Asset & Warranty", essentials: false, office: "Basic", business: "Full", enterprise: "Lifecycle + budgeting" },
      { capability: "Executive Reporting & QBRs", essentials: false, office: "Semi-annual", business: "Quarterly", enterprise: "Monthly" },
      { capability: "vCIO", essentials: false, office: "Semi-annual", business: "Quarterly", enterprise: "Monthly" },
    ]
  },
  {
    id: "cybersecurity",
    title: "Cybersecurity",
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
    id: "compliance",
    title: "Compliance & Governance",
    rows: [
      { capability: "HIPAA Compliance Module", essentials: false, office: "Add-on", business: "Add-on", enterprise: true },
      { capability: "SOC 2 Readiness", essentials: false, office: "Add-on", business: "Add-on", enterprise: true },
      { capability: "Penetration Testing", essentials: false, office: "Add-on", business: "Add-on", enterprise: "Annual included" },
      { capability: "Policy & Procedure Templates", essentials: false, office: false, business: "Basic", enterprise: "Custom" },
      { capability: "Audit Log Retention", essentials: false, office: "30 days", business: "90 days", enterprise: "1 year+" },
    ]
  },
  {
    id: "add-ons",
    title: "Available Add-Ons",
    rows: [
      { capability: "UCaaS / VoIP Telephony", essentials: "Add-on", office: "Add-on", business: "Add-on", enterprise: "Add-on" },
      { capability: "Extended Retention & Archiving", essentials: "Add-on", office: "Add-on", business: "Add-on", enterprise: "Add-on" },
      { capability: "24/7 SOC Monitoring", essentials: "Add-on", office: true, business: true, enterprise: true },
    ]
  }
];

const serviceToCategory: Record<string, string[]> = {
  "ProActive-Ecosystem-Packages": ["managed-it", "cybersecurity", "cloud-backup", "identity"],
  "managed-it-support": ["managed-it"],
  "managed-workplace": ["managed-it", "identity"],
  "cloud-backup": ["cloud-backup"],
  "security-awareness": ["cybersecurity"],
  "co-managed-it": ["managed-it"],
  "threat-detection": ["cybersecurity"],
  "security-operations": ["cybersecurity"],
  "disaster-recovery": ["cloud-backup"],
  "identity-access": ["identity"],
  "compliance-reports": ["compliance"],
  "virtual-cio": ["managed-it"],
  "network-services": ["site-services"],
  "endpoint-protection": ["cybersecurity"],
  "email-security": ["cybersecurity"],
  "vulnerability-management": ["cybersecurity"],
  "cloud-services": ["cloud-backup", "identity"],
  "microsoft-365": ["identity", "cloud-backup"],
  "google-workspace": ["identity", "cloud-backup"],
};

const tiers = [
  { id: "essentials", name: "IT Essentials", price: "Core IT" },
  { id: "office", name: "Office", price: "$65/user" },
  { id: "business", name: "Business", price: "$95/user", featured: true },
  { id: "enterprise", name: "Enterprise", price: "Custom" },
];

interface ServiceCapabilityMatrixProps {
  serviceKey?: string;
  categoryIds?: string[];
  highlightTier?: "essentials" | "office" | "business" | "enterprise";
  className?: string;
}

export function ServiceCapabilityMatrix({ 
  serviceKey,
  categoryIds,
  highlightTier,
  className = ""
}: ServiceCapabilityMatrixProps) {
  const prefersReducedMotion = useReducedMotion();
  
  const categoriesToShow = categoryIds 
    || (serviceKey && serviceToCategory[serviceKey]) 
    || [];
  
  const filteredCategories = categoriesToShow.length > 0
    ? allCategories.filter(cat => categoriesToShow.includes(cat.id))
    : [];

  if (filteredCategories.length === 0) {
    return null;
  }

  const renderCellValue = (value: TierValue, tierId: string) => {
    const isHighlighted = highlightTier === tierId;
    
    if (value === true) {
      return (
        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${
          isHighlighted ? 'bg-de-raised text-de-accent-ink' : 'bg-de-bg text-de-accent-ink'
        }`}>
          <Check className="w-4 h-4" />
        </span>
      );
    }
    if (value === false) {
      return <span className="text-white/20">—</span>;
    }
    if (value === "Add-on" || value === "Optional") {
      return (
        <span className={`px-2 py-0.5 rounded-full text-sm font-medium ${
          isHighlighted 
            ? 'bg-de-raised text-de-accent-ink border border-de-hairline' 
            : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
        }`}>
          {value}
        </span>
      );
    }
    return (
      <span className={`px-2 py-0.5 rounded-full text-sm font-medium ${
        isHighlighted 
          ? 'bg-de-raised text-de-accent-ink border border-de-hairline' 
          : 'bg-white/5 text-white/70 border border-white/10'
      }`}>
        {value}
      </span>
    );
  };

  return (
    <motion.div
      className={`rounded-2xl border border-de-hairline overflow-hidden bg-de-raised ${className}`}
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      data-testid="service-capability-matrix"
    >
      {/* Tier Headers */}
      <div className="grid grid-cols-5 gap-1 p-3 bg-de-bg border-b border-de-hairline">
        <div className="text-white/55 text-xs font-medium uppercase tracking-wider flex items-center">
          Capability
        </div>
        {tiers.map((tier) => (
          <div 
            key={tier.id}
            className={`text-center p-2 rounded-lg transition-all ${
              highlightTier === tier.id 
                ? 'bg-de-raised border border-de-hairline' 
                : tier.featured 
                  ? 'bg-de-bg border border-de-hairline' 
                  : ''
            }`}
          >
            <div className={`text-xs font-bold ${
              highlightTier === tier.id ? 'text-de-accent-ink' : 'text-white'
            }`}>
              {tier.name}
            </div>
            <div className="text-xs text-white/50">{tier.price}</div>
            {highlightTier === tier.id && (
              <div className="text-xs text-de-accent-ink mt-0.5">Recommended</div>
            )}
          </div>
        ))}
      </div>

      {/* Category Rows */}
      {filteredCategories.map((category) => (
        <div key={category.id} className="border-b border-white/5 last:border-b-0">
          {/* Category Header */}
          <div className="px-4 py-2 bg-de-bg border-b border-de-hairline">
            <span className="text-sm font-semibold text-white/80">{category.title}</span>
          </div>
          
          {/* Capability Rows */}
          {category.rows.map((row, idx) => (
            <div 
              key={idx}
              className={`grid grid-cols-5 gap-1 px-3 py-2 ${
                idx % 2 === 0 ? 'bg-white/[0.01]' : ''
              } hover:bg-white/[0.03] transition-colors`}
            >
              <div className="text-white/70 text-sm flex items-center">
                {row.capability}
              </div>
              <div className={`text-center flex items-center justify-center ${
                highlightTier === 'essentials' ? 'bg-de-raised rounded' : ''
              }`}>
                {renderCellValue(row.essentials, 'essentials')}
              </div>
              <div className={`text-center flex items-center justify-center ${
                highlightTier === 'office' ? 'bg-de-raised rounded' : ''
              }`}>
                {renderCellValue(row.office, 'office')}
              </div>
              <div className={`text-center flex items-center justify-center ${
                highlightTier === 'business' ? 'bg-de-raised rounded' : ''
              }`}>
                {renderCellValue(row.business, 'business')}
              </div>
              <div className={`text-center flex items-center justify-center ${
                highlightTier === 'enterprise' ? 'bg-de-raised rounded' : ''
              }`}>
                {renderCellValue(row.enterprise, 'enterprise')}
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Footer Link */}
      <div className="p-4 bg-white/[0.02] border-t border-white/10">
        <Link href="/ecosystem-pricing">
          <span className="inline-flex items-center gap-2 text-sm text-de-accent-ink hover:text-de-accent-ink transition-colors cursor-pointer">
            View complete service matrix
            <ChevronRight className="w-4 h-4" />
          </span>
        </Link>
      </div>
    </motion.div>
  );
}
