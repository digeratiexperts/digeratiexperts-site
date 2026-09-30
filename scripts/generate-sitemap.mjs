/**
 * Regenerates public/sitemap.xml with marketing URLs + Door 2 family pages.
 * Warehouse, portal, checkout, and SKU PDPs are intentionally excluded (noindex).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const SITE = "https://digeratiexperts.com";

const STATIC = [
  ["/", "weekly", "1.0"],
  ["/solutions", "monthly", "0.9"],
  ["/solutions/proactive-ecosystem", "monthly", "0.9"],
  ["/solutions/proactive-it-ecosystem", "monthly", "0.8"],
  ["/solutions/proactive-office-ecosystem", "monthly", "0.8"],
  ["/solutions/proactive-business-ecosystem", "monthly", "0.8"],
  ["/solutions/proactive-enterprise-ecosystem", "monthly", "0.8"],
  ["/solutions/co-managed-it", "monthly", "0.8"],
  ["/solutions/standalone-services", "monthly", "0.8"],
  ["/solutions/managed-it-support", "monthly", "0.7"],
  ["/solutions/managed-workplace", "monthly", "0.7"],
  ["/solutions/cloud-backup", "monthly", "0.7"],
  ["/solutions/backup-disaster-recovery", "monthly", "0.7"],
  ["/solutions/threat-detection", "monthly", "0.7"],
  ["/solutions/security-operations", "monthly", "0.7"],
  ["/solutions/unified-security", "monthly", "0.7"],
  ["/solutions/security-awareness", "monthly", "0.7"],
  ["/solutions/data-encryption", "monthly", "0.7"],
  ["/solutions/compliance-reports", "monthly", "0.7"],
  ["/solutions/vcio-strategy", "monthly", "0.7"],
  ["/services/ucaas", "monthly", "0.7"],
  ["/book", "weekly", "0.9"],
  ["/pricing", "monthly", "0.9"],
  ["/industries/healthcare", "monthly", "0.8"],
  ["/industries/accounting-finance", "monthly", "0.7"],
  ["/industries/law-firms", "monthly", "0.7"],
  ["/industries/real-estate", "monthly", "0.7"],
  ["/industries/nonprofits", "monthly", "0.7"],
  ["/industries/animal-hospitals", "monthly", "0.7"],
  ["/locations/chandler-az", "monthly", "0.8"],
  ["/locations/phoenix-az", "monthly", "0.8"],
  ["/locations/mesa-az", "monthly", "0.8"],
  ["/locations/gilbert-az", "monthly", "0.8"],
  ["/locations/tempe-az", "monthly", "0.8"],
  ["/locations/scottsdale-az", "monthly", "0.8"],
  ["/resources/case-studies", "monthly", "0.7"],
  ["/resources/blog", "weekly", "0.8"],
  ["/resources/cyber-facts", "weekly", "0.7"],
  ["/resources/blog/what-a-cyber-risk-assessment-finds-before-attackers-do", "monthly", "0.6"],
  ["/resources/blog/multilayer-ransomware-defense-arizona-businesses", "monthly", "0.6"],
  ["/resources/blog/can-ransomware-encrypt-your-backups", "monthly", "0.6"],
  ["/resources/blog/first-24-hours-after-ransomware-attack", "monthly", "0.6"],
  ["/resources/blog/why-mfa-alone-does-not-stop-ransomware", "monthly", "0.6"],
  ["/resources/blog/email-security-more-than-spam-filtering", "monthly", "0.6"],
  ["/resources/blog/arizona-smb-cybersecurity-checklist", "monthly", "0.6"],
  ["/resources/blog/cyber-insurance-requirements-small-businesses", "monthly", "0.6"],
  ["/resources/blog/managed-it-pricing-phoenix-chandler", "monthly", "0.6"],
  ["/resources/blog/managed-it-vs-break-fix-it", "monthly", "0.6"],
  ["/resources/blog/co-managed-it-vs-hiring-another-it-employee", "monthly", "0.6"],
  ["/resources/blog/standalone-it-services-vs-full-managed-it-ownership", "monthly", "0.6"],
  ["/resources/blog/questions-before-switching-it-providers", "monthly", "0.6"],
  ["/resources/blog/shadow-ai-is-the-new-shadow-it", "monthly", "0.6"],
  ["/resources/blog/chatgpt-copilot-gemini-claude-business-data-security", "monthly", "0.6"],
  ["/resources/blog/hipaa-cmmc-nist-cyber-insurance-managed-it-discipline", "monthly", "0.6"],
  ["/resources/security-updates", "weekly", "0.6"],
  ["/resources/videos", "monthly", "0.5"],
  ["/resources/security-checklist", "monthly", "0.6"],
  ["/resources/datasheets", "monthly", "0.7"],
  ["/resources/briefs", "monthly", "0.6"],
  ["/resources/briefs/cyber-risk-operating-brief", "monthly", "0.6"],
  ["/resources/briefs/ransomware-readiness-brief", "monthly", "0.6"],
  ["/resources/briefs/cyber-insurance-brief", "monthly", "0.6"],
  ["/resources/briefs/proactive-operating-brief", "monthly", "0.6"],
  ["/go", "weekly", "0.8"],
  ["/go/cyber-risk-assessment", "weekly", "0.9"],
  ["/go/managed-it", "weekly", "0.8"],
  ["/go/ransomware-readiness", "weekly", "0.8"],
  ["/go/co-managed-it", "weekly", "0.8"],
  ["/go/healthcare-it", "weekly", "0.8"],
  ["/go/cyber-insurance", "weekly", "0.8"],
  ["/go/email-security", "weekly", "0.7"],
  ["/go/proactive-business", "weekly", "0.8"],
  ["/resources/downtime-calculator", "monthly", "0.6"],
  ["/resources/ebook/defending-digital-realm", "monthly", "0.5"],
  ["/about/mission-values", "monthly", "0.5"],
  ["/about/team", "monthly", "0.5"],
  ["/about/compliance", "monthly", "0.5"],
  ["/about/client-bill-of-rights", "monthly", "0.5"],
  ["/about/guarantee", "monthly", "0.5"],
  ["/about/21-questions", "monthly", "0.5"],
  ["/about/press", "monthly", "0.6"],
  ["/trust/trust-center", "monthly", "0.5"],
  ["/trust/vulnerability-disclosure", "yearly", "0.4"],
  ["/legal/privacy-policy", "yearly", "0.4"],
  ["/legal/terms-of-use", "yearly", "0.4"],
  ["/contact", "monthly", "0.7"],
  ["/store", "weekly", "0.8"],
];

const curatedPath = path.join(root, "client/src/data/curatedSolutions.ts");
const curatedSrc = fs.readFileSync(curatedPath, "utf8");
const familyIds = [
  ...new Set(
    [...curatedSrc.matchAll(/id:\s+"(it_operations|endpoint_devices|identity_access|email_collaboration|cybersecurity_operations|network_connectivity|backup_continuity|compliance_risk|security_awareness|business_communications|hardware_lifecycle|documentation_standards|technology_strategy)"/g)].map(
      (match) => match[1],
    ),
  ),
];
const familyPaths = familyIds.map((id) => `/store/solutions/${id.replaceAll("_", "-")}`);

const registryPath = path.join(root, "client/src/data/resourceRegistry.v2.json");
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const resourceRoutes = (registry.resources || [])
  .filter((item) => item.route && item.status === "ready-draft")
  .map((item) => item.route);

function urlEntry(loc, changefreq, priority) {
  return `  <url><loc>${SITE}${loc}</loc><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}

const lines = [
  `<?xml version="1.0" encoding="UTF-8"?>`,
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
  `  <!-- Generated by scripts/generate-sitemap.mjs — do not hand-edit product URLs -->`,
  ...STATIC.map(([loc, freq, pri]) => urlEntry(loc, freq, pri)),
  `  <!-- Door 2 solution families (${familyPaths.length}) -->`,
  ...familyPaths.map((loc) => urlEntry(loc, "weekly", "0.7")),
  `  <!-- Resource PDFs (${resourceRoutes.length}) -->`,
  ...resourceRoutes.map((loc) => urlEntry(loc, "monthly", "0.6")),
  `</urlset>`,
  ``,
];

const out = path.join(root, "public/sitemap.xml");
fs.writeFileSync(out, lines.join("\n"), "utf8");
console.log(
  `Wrote ${out} (${STATIC.length} static + ${familyPaths.length} families + ${resourceRoutes.length} resources)`,
);
