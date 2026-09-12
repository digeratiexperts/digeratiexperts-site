import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import { pricing } from "@/data/pricing";
import { CTA } from "@/lib/ctaCopy";
import { 
  Search, 
  Moon, 
  Sun, 
  Printer, 
  Eye, 
  EyeOff, 
  ChevronDown, 
  Check, 
  Zap,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Density = "cozy" | "compact";

interface FeatureRow {
  name: string;
  tiers: {
    essentials: string | boolean;
    office: string | boolean;
    business: string | boolean;
    enterprise: string | boolean;
  };
  isUpgrade?: boolean;
}

interface Section {
  id: string;
  title: string;
  features: FeatureRow[];
}

const matrixData: Section[] = [
  {
    id: "managed-it",
    title: "Managed IT",
    features: [
      { name: "Help Desk & SLA", tiers: { essentials: false, office: "8×5", business: "8×5 + Priority", enterprise: "VIP + 24×7 opt" } },
      { name: "Remote Monitoring & Alerting", tiers: { essentials: true, office: true, business: true, enterprise: true } },
      { name: "Patch & App Management", tiers: { essentials: true, office: true, business: true, enterprise: true } },
      { name: "Remote Support & Quick Assist", tiers: { essentials: false, office: true, business: true, enterprise: true } },
      { name: "IT Documentation & KB", tiers: { essentials: false, office: "Standard", business: "Comprehensive", enterprise: "Full + Client access" } },
      { name: "Client Portal & Ticketing", tiers: { essentials: false, office: true, business: true, enterprise: true } },
      { name: "Asset & Warranty", tiers: { essentials: false, office: "Basic", business: "Full", enterprise: "Lifecycle + budgeting" } },
      { name: "Executive Reporting & QBRs", tiers: { essentials: false, office: "Semi-annual", business: "Quarterly", enterprise: "Monthly" } },
      { name: "IT Governance & Roadmaps", tiers: { essentials: false, office: false, business: false, enterprise: true }, isUpgrade: true },
      { name: "vCIO", tiers: { essentials: false, office: "Semi-annual", business: "Quarterly", enterprise: "Monthly" } },
    ]
  },
  {
    id: "cybersecurity",
    title: "Cybersecurity",
    features: [
      { name: "Baseline Threat Protection", tiers: { essentials: true, office: true, business: true, enterprise: true } },
      { name: "Data Safeguards & Identity", tiers: { essentials: true, office: true, business: true, enterprise: true } },
      { name: "Email Security & MFA", tiers: { essentials: false, office: "Secure gateway", business: "Advanced gateway", enterprise: "Advanced + SSO" } },
      { name: "Endpoint Detection & Response (EDR)", tiers: { essentials: false, office: "EDR", business: "EDR + rollback", enterprise: "EDR + MDR" } },
      { name: "Security Awareness & Phishing", tiers: { essentials: false, office: "Baseline", business: "Interactive + sims", enterprise: "Role-based + sims" } },
      { name: "SaaS App Security Monitoring", tiers: { essentials: false, office: "Optional", business: true, enterprise: true } },
      { name: "Dark Web Monitoring", tiers: { essentials: false, office: true, business: true, enterprise: true } },
      { name: "Vulnerability Management", tiers: { essentials: false, office: false, business: "Internal", enterprise: "Internal + External" }, isUpgrade: true },
    ]
  }
];

export default function EcosystemMatrixOfficial() {
  const [density, setDensity] = useState<Density>("cozy");
  const [isDark, setIsDark] = useState(true);
  const [showUpgrades, setShowUpgrades] = useState(false);
  const [dimSame, setDimSame] = useState(false);
  const [hideSame, setHideSame] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState<string[]>(matrixData.map(s => s.id));

  const toggleSection = (id: string) => {
    setExpandedSections(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const renderBadge = (value: string | boolean) => {
    if (value === true) return <Badge className="border-de-hairline bg-de-bg text-de-accent-ink hover:bg-de-bg"><Check className="w-3 h-3" /></Badge>;
    if (value === false || value === "—") return <span className="text-white/20">—</span>;
    
    const isPro = typeof value === 'string' && (value.includes("VIP") || value.includes("MDR") || value.includes("Full"));
    
    return (
      <Badge variant="outline" className={`${isPro ? 'border-de-hairline text-de-magenta-ink bg-de-raised' : 'border-de-hairline text-white/70 bg-de-bg'}`}>
        {value}
      </Badge>
    );
  };

  const filteredData = matrixData.map(section => ({
    ...section,
    features: section.features.filter(f => 
      f.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(section => section.features.length > 0);

  return (
    <main id="page-main" className={`min-h-screen transition-colors duration-300 ${isDark ? "bg-[#0a0a0f] text-white" : "bg-slate-50 text-slate-900"}`}>
      <Helmet>
        <title>Service Matrix | Digerati Experts</title>
        <meta name="description" content="Compare Digerati Experts IT service tiers: IT Essentials, Office, Business, and Enterprise. Interactive service matrix with feature comparison across managed IT and cybersecurity offerings." />
        <meta property="og:title" content="Service Matrix | Digerati Experts" />
        <meta property="og:description" content="Interactive service tier comparison for managed IT and cybersecurity solutions." />
        <meta property="og:type" content="website" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* HERO */}
        <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-black tracking-tight mb-2 text-de-magenta-ink">
              Digerati Experts — Service Matrix
            </h1>
            <p className="text-white/60 text-lg">Security-First IT bundles · Compare tiers · Explore add-ons</p>
            <div className="flex gap-4 mt-4 text-sm font-medium">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#D3126A]"></span> Included</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-de-magenta"></span> Premium</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-white/20"></span> N/A</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/55" />
              <Input 
                placeholder="Search features..." 
                className="pl-10 border-de-hairline bg-de-raised focus:border-[#D3126A]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button 
                variant={showUpgrades ? "default" : "outline"}
                size="sm"
                aria-pressed={showUpgrades}
                className={showUpgrades ? "bg-de-magenta text-white" : "border-white/20 text-white hover:text-white"}
                onClick={() => setShowUpgrades(!showUpgrades)}
              >
                <Zap className="w-4 h-4 mr-2" aria-hidden="true" /> Highlight Upgrades
              </Button>
              <div className="flex rounded-md border border-de-hairline bg-de-raised p-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  aria-pressed={density === "cozy"}
                  className={density === "cozy" ? "bg-white/10 text-white" : "text-white"}
                  onClick={() => setDensity("cozy")}
                >Cozy</Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  aria-pressed={density === "compact"}
                  className={density === "compact" ? "bg-white/10 text-white" : "text-white"}
                  onClick={() => setDensity("compact")}
                >Compact</Button>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="border-white/20 text-white hover:text-white"
                aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
                aria-pressed={isDark}
                onClick={() => setIsDark(!isDark)}
              >
                {isDark ? <Sun className="w-4 h-4" aria-hidden="true" /> : <Moon className="w-4 h-4" aria-hidden="true" />}
              </Button>
              <Button variant="outline" size="sm" className="border-white/20 text-white hover:text-white" aria-label="Print this matrix" onClick={() => window.print()}>
                <Printer className="w-4 h-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>

        {/* TIERS HEADER */}
        <div className="grid grid-cols-5 gap-4 mb-6 sticky top-0 z-40 bg-de-bg py-4 border-b border-de-hairline">
          <div className="text-white/55 font-bold uppercase text-xs self-center">Capability</div>
          <div className="p-4 rounded-xl bg-de-raised border border-de-hairline text-center">
            <Badge variant="secondary" className="mb-2 border border-de-hairline bg-de-bg text-white/70">IT</Badge>
            <h3 className="font-bold text-lg">IT</h3>
            <p className="text-xs text-white/50">${pricing.it.user} /user·mo</p>
          </div>
          <div className="p-4 rounded-xl bg-de-raised border border-de-hairline text-center">
            <Badge variant="secondary" className="mb-2 bg-de-bg text-de-magenta-ink">Office</Badge>
            <h3 className="font-bold text-lg text-de-magenta-ink">Office</h3>
            <p className="text-xs text-de-magenta-ink/60">${pricing.office.user} /user·mo</p>
          </div>
          <div className="p-4 rounded-xl bg-de-raised border border-de-hairline text-center">
            <Badge variant="secondary" className="mb-2 bg-de-bg text-de-magenta-ink">Business</Badge>
            <h3 className="font-bold text-lg text-white">Business</h3>
            <p className="text-xs text-white/50">${pricing.business.user} /user·mo</p>
          </div>
          <div className="p-4 rounded-xl bg-de-raised border border-de-hairline text-center">
            <Badge variant="secondary" className="mb-2 bg-de-raised text-de-magenta-ink">Custom</Badge>
            <h3 className="font-bold text-lg text-de-magenta-ink">Enterprise</h3>
            <p className="text-xs text-de-magenta-ink/60">Multi-site + MDR</p>
          </div>
        </div>

        {/* MATRIX BODY */}
        <div className="space-y-8">
          {filteredData.map((section) => (
            <div key={section.id} className="overflow-hidden rounded-2xl border border-de-hairline bg-de-raised">
              <button 
                type="button"
                aria-expanded={expandedSections.includes(section.id)}
                className="flex w-full items-center justify-between border-b border-de-hairline bg-de-raised p-4 transition-colors hover:bg-de-bg"
                onClick={() => toggleSection(section.id)}
              >
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <span className="w-1.5 h-6 bg-de-magenta rounded-full"></span>
                  {section.title}
                </h2>
                <ChevronDown aria-hidden="true" className={`w-5 h-5 text-white/55 transition-transform ${expandedSections.includes(section.id) ? "" : "-rotate-90"}`} />
              </button>
              
              {expandedSections.includes(section.id) && (
                <div className="divide-y divide-white/5">
                  {section.features.map((feature, idx) => (
                    <div 
                      key={idx} 
                      className={`grid grid-cols-5 gap-4 items-center transition-all ${density === "compact" ? "py-2 px-4" : "py-4 px-4"} ${showUpgrades && feature.isUpgrade ? "bg-de-raised ring-1 ring-inset ring-de-accent" : "hover:bg-white/[0.01]"}`}
                    >
                      <div className="flex items-center gap-2 group">
                        <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">{feature.name}</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger aria-label={`About ${feature.name}`} className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-de-magenta-ink"><Info className="w-3.5 h-3.5 text-white/55 hover:text-white" aria-hidden="true" /></TooltipTrigger>
                            <TooltipContent><p className="max-w-xs text-xs">Standard industry definition for {feature.name}.</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="text-center">{renderBadge(feature.tiers.essentials)}</div>
                      <div className="text-center">{renderBadge(feature.tiers.office)}</div>
                      <div className="text-center">{renderBadge(feature.tiers.business)}</div>
                      <div className="text-center">{renderBadge(feature.tiers.enterprise)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* FOOTER NOTE */}
        <div className="mt-12 p-6 rounded-2xl bg-de-raised to-transparent border border-white/10 text-center">
          <p className="text-white/55 text-sm">
            {`Minimum billing: Office $${pricing.office.siteMin}/site/mo; Business $${pricing.business.siteMin.toLocaleString()}/site/mo; Enterprise $${pricing.enterprise.siteMin.toLocaleString()}/site/mo.`} 
            Billing rule: Minimums apply when per-user total &lt; minimum.
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <Button asChild className="bg-de-magenta hover:bg-de-magenta">
              <Link href="/book">{CTA.primary}</Link>
            </Button>
          </div>
        </div>
      </div>
      
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .bg-white\\/[0.02] { background: transparent !important; }
          .border-white\\/10 { border-color: #eee !important; }
          .text-white\\/60 { color: #666 !important; }
          .text-white { color: black !important; }
        }
      `}</style>
    </main>
  );
}
