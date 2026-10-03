import { estimateMonthly, pricing, type PricingTierKey } from "@/data/pricing";
import { PageTemplate } from "@/components/PageTemplate";
import { Chapter, ClosingCta, Container, cardPaper } from "@/components/site/chapters";
import { CTA } from "@/lib/ctaCopy";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowRight, Plus, Minus, DollarSign, Clock } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";

const industryMultipliers: Record<string, { name: string; multiplier: number }> = {
  'general-office': { name: 'General Office', multiplier: 1.6 },
  'law-firm': { name: 'Law Firm', multiplier: 2.0 },
  'cpa-firm': { name: 'CPA / Accounting Firm', multiplier: 1.8 },
  'medical': { name: 'Medical / Healthcare', multiplier: 2.5 },
  'real-estate': { name: 'Real Estate', multiplier: 1.6 },
  'animal-hospital': { name: 'Animal Hospital / Vet', multiplier: 2.2 },
  'retail': { name: 'Retail / Sales', multiplier: 1.7 },
  'manufacturing': { name: 'Manufacturing', multiplier: 2.0 },
  'nonprofit': { name: 'Nonprofit', multiplier: 1.5 },
  'finance': { name: 'Financial Services', multiplier: 2.3 },
};

const servicePackages: Record<PricingTierKey, { name: string; key: PricingTierKey }> = {
  it: { name: pricing.it.label, key: "it" },
  office: { name: pricing.office.label, key: "office" },
  business: { name: pricing.business.label, key: "business" },
  enterprise: { name: pricing.enterprise.label, key: "enterprise" },
};

export default function DowntimeCalculator() {
  useSEO({
    title: 'Downtime Cost Calculator',
    description: 'Calculate how much IT downtime costs your business. Free downtime cost calculator shows the real impact of outages on your productivity and revenue.',
    canonical: '/resources/downtime-calculator',
  });

  const [activeTab, setActiveTab] = useState<'downtime' | 'service'>('downtime');
  
  // Downtime calculator state
  const [industry, setIndustry] = useState('general-office');
  const [employees, setEmployees] = useState('25');
  const [hourlyWage, setHourlyWage] = useState('35');
  const [downtimeHours, setDowntimeHours] = useState('4');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [rtoHours, setRtoHours] = useState('4');
  const [rpoHours, setRpoHours] = useState('1');
  const [incidentsPerYear, setIncidentsPerYear] = useState('4');
  const [showDowntimeResults, setShowDowntimeResults] = useState(false);
  const [downtimeResult, setDowntimeResult] = useState({ perIncident: 0, annual: 0, riskLevel: '' });

  // Service calculator state
  const [serviceEmployees, setServiceEmployees] = useState('10');
  const [servicePackage, setServicePackage] = useState<PricingTierKey>("business");
  const [showServiceResults, setShowServiceResults] = useState(false);
  const [serviceResult, setServiceResult] = useState({ monthly: 0, quarterly: 0, annual: 0 });

  const calculateDowntime = () => {
    const emp = parseFloat(employees) || 0;
    const wage = parseFloat(hourlyWage) || 0;
    const hours = parseFloat(downtimeHours) || 0;
    const multiplier = industryMultipliers[industry]?.multiplier || 1.6;
    const incidents = parseFloat(incidentsPerYear) || 4;

    const perIncident = emp * wage * hours * multiplier;
    const annual = perIncident * incidents;

    let riskLevel = 'low';
    if (annual > 100000) riskLevel = 'critical';
    else if (annual > 50000) riskLevel = 'high';
    else if (annual > 20000) riskLevel = 'moderate';

    setDowntimeResult({ perIncident, annual, riskLevel });
    setShowDowntimeResults(true);
  };

  const calculateService = () => {
    const emp = parseFloat(serviceEmployees) || 0;
    const monthly = estimateMonthly(servicePackage, emp, 1);
    setServiceResult({ monthly, quarterly: monthly * 3, annual: monthly * 12 });
    setShowServiceResults(true);
  };

  const getRiskBadge = (level: string) => {
    const base = "inline-block px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wide border text-white";
    switch (level) {
      case 'critical':
        return <span className={`${base} border-red-400/60 bg-red-500/20`}>Critical Risk - Immediate Action Required</span>;
      case 'high':
        return <span className={`${base} border-[#D3126A]/60 bg-[#D3126A]/20`}>High Risk - Protection Recommended</span>;
      case 'moderate':
        return <span className={`${base} border-[#D3126A]/60 bg-[#D3126A]/20`}>Moderate Risk - Consider Protection</span>;
      default:
        return <span className={`${base} border-emerald-400/60 bg-emerald-500/20`}>Low Risk - Maintain Vigilance</span>;
    }
  };

  const labelClass = "mb-2 block text-xs font-semibold uppercase tracking-wide text-[#1A1228]";
  const fieldClass =
    "h-14 border border-[var(--de-paper-hairline)] bg-white text-[#1A1228] placeholder:text-[#6B6478] hover:border-[#A30E52] focus-visible:border-[#A30E52] focus-visible:ring-2 focus-visible:ring-[#ec4899] transition-colors";
  const smallFieldClass = fieldClass.replace("h-14", "h-12");
  const selectContentClass = "bg-white text-[#1A1228] border-[var(--de-paper-hairline)]";
  const selectItemClass = "text-[#1A1228] focus:bg-[#D3126A]/10 focus:text-[#1A1228]";
  const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const tabClass = (on: boolean) =>
    `flex min-h-14 flex-1 items-center justify-center gap-2 border-b-2 px-4 py-4 text-sm font-bold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ec4899] ${
      on
        ? 'border-b-[#A30E52] bg-[#D3126A]/[0.06] text-de-magenta-paper-ink'
        : 'border-b-transparent text-[#4A445A] hover:bg-black/[0.03] hover:text-[#1A1228]'
    }`;
  const resultPanel = "relative overflow-hidden rounded-xl border border-[#D3126A]/25 bg-[#151217] p-6 md:p-8";
  const resultLabel = "mb-2 text-xs font-bold uppercase tracking-wider text-white/65";
  const resultNum = "font-mono font-extrabold text-[#f0187a]";

  return (
    <PageTemplate
      title="IT Cost Calculators"
      eyebrow="Business Impact Calculator"
      subtitle="Understand the true cost of IT downtime and get accurate service estimates for your business."
      breadcrumbs={[{ label: "Resources", href: "/resources" }, { label: "Downtime Calculator" }]}
      layout="chapters"
    >
      <Chapter tone="paper" seam={false}>
        <Container>
          <div className="mx-auto max-w-4xl">
            <div className={`${cardPaper} overflow-hidden`}>
              <div className="flex border-b border-[var(--de-paper-hairline)]">
                <button
                  type="button"
                  aria-pressed={activeTab === 'downtime'}
                  onClick={() => setActiveTab('downtime')}
                  className={tabClass(activeTab === 'downtime')}
                  data-testid="tab-downtime-cost"
                >
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  Downtime Cost
                </button>
                <button
                  type="button"
                  aria-pressed={activeTab === 'service'}
                  onClick={() => setActiveTab('service')}
                  className={tabClass(activeTab === 'service')}
                  data-testid="tab-service-cost"
                >
                  <DollarSign className="h-4 w-4" aria-hidden="true" />
                  Service Cost
                </button>
              </div>

              <div className="p-6 md:p-10">
                {activeTab === 'downtime' && (
                  <div className="animate-in fade-in duration-300 motion-reduce:animate-none">
                    <h2 className="mb-3 font-heading text-2xl font-semibold text-[#1A1228] md:text-3xl">
                      What's Downtime Really Costing You?
                    </h2>
                    <p className="mb-8 max-w-[60ch] text-base leading-relaxed text-[#3A3448]">
                      Calculate the true cost of IT downtime for your business with industry-specific multipliers and RTO/RPO factors.
                    </p>

                    <div className="mb-6">
                      <Label id="calc-industry-label" className={labelClass}>Industry</Label>
                      <Select value={industry} onValueChange={setIndustry}>
                        <SelectTrigger aria-labelledby="calc-industry-label" className={fieldClass} data-testid="select-calc-industry">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className={selectContentClass}>
                          {Object.entries(industryMultipliers).map(([key, { name, multiplier }]) => (
                            <SelectItem key={key} value={key} className={selectItemClass} data-testid={`option-calc-${key}`}>
                              {name} ({multiplier}×)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="mb-6 grid gap-6 md:grid-cols-2">
                      <div>
                        <Label htmlFor="calc-employees" className={labelClass}>Employees Affected</Label>
                        <Input id="calc-employees" type="number" inputMode="decimal" value={employees} onChange={(e) => setEmployees(e.target.value)} className={fieldClass} placeholder="25" data-testid="input-employees" />
                      </div>
                      <div>
                        <Label htmlFor="calc-wage" className={labelClass}>Avg Hourly Wage ($)</Label>
                        <Input id="calc-wage" type="number" inputMode="decimal" value={hourlyWage} onChange={(e) => setHourlyWage(e.target.value)} className={fieldClass} placeholder="35" data-testid="input-hourly-wage" />
                      </div>
                    </div>

                    <div className="mb-6">
                      <Label htmlFor="calc-hours" className={labelClass}>Expected Downtime (Hours)</Label>
                      <Input id="calc-hours" type="number" inputMode="decimal" value={downtimeHours} onChange={(e) => setDowntimeHours(e.target.value)} className={fieldClass} placeholder="4" data-testid="input-downtime-hours" />
                    </div>

                    <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                      <CollapsibleTrigger className="mb-6 flex min-h-14 w-full items-center justify-between rounded-lg border border-[var(--de-paper-hairline)] bg-[var(--de-paper)] px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#1A1228] transition-colors hover:border-[#A30E52] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899]" data-testid="toggle-advanced-options">
                        <span>Advanced Options (RTO/RPO & Annual Impact)</span>
                        {advancedOpen ? <Minus className="h-5 w-5 text-[#A30E52]" aria-hidden="true" /> : <Plus className="h-5 w-5 text-[#A30E52]" aria-hidden="true" />}
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mb-6">
                        <div className="space-y-4 rounded-lg border border-[var(--de-paper-hairline)] bg-[var(--de-paper)] p-5 md:p-6">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <Label htmlFor="calc-rto" className={labelClass}>RTO - Recovery Time Objective (Hours)</Label>
                              <Input id="calc-rto" type="number" inputMode="decimal" value={rtoHours} onChange={(e) => setRtoHours(e.target.value)} className={smallFieldClass} placeholder="4" data-testid="input-rto" />
                            </div>
                            <div>
                              <Label htmlFor="calc-rpo" className={labelClass}>RPO - Recovery Point Objective (Hours)</Label>
                              <Input id="calc-rpo" type="number" inputMode="decimal" value={rpoHours} onChange={(e) => setRpoHours(e.target.value)} className={smallFieldClass} placeholder="1" data-testid="input-rpo" />
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="calc-incidents" className={labelClass}>Expected Incidents Per Year</Label>
                            <Input id="calc-incidents" type="number" inputMode="decimal" value={incidentsPerYear} onChange={(e) => setIncidentsPerYear(e.target.value)} className={smallFieldClass} placeholder="4" data-testid="input-incidents" />
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    <Button
                      onClick={calculateDowntime}
                      className="h-14 w-full bg-[#D3126A] text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#b80f5c]"
                      data-testid="button-calculate-downtime"
                    >
                      Calculate Cost <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
                    </Button>

                    <div aria-live="polite">
                      {showDowntimeResults && (
                        <div className={`mt-8 ${resultPanel} animate-in slide-in-from-bottom-4 duration-500 motion-reduce:animate-none`}>
                          <div className="absolute inset-x-0 top-0 h-0.5 bg-[#D3126A]" aria-hidden="true" />
                          <div className="mb-6 grid gap-8 md:grid-cols-2">
                            <div>
                              <p className={resultLabel}>Per-Incident Cost</p>
                              <p className={`${resultNum} text-3xl md:text-4xl`} data-testid="result-per-incident">
                                ${money(downtimeResult.perIncident)}
                              </p>
                            </div>
                            <div>
                              <p className={resultLabel}>Annual Downtime Cost</p>
                              <p className={`${resultNum} text-4xl md:text-5xl`} data-testid="result-annual">
                                ${money(downtimeResult.annual)}
                              </p>
                            </div>
                          </div>
                          <div className="mb-4">{getRiskBadge(downtimeResult.riskLevel)}</div>
                          <p className="text-sm leading-relaxed text-white/70">
                            Based on <strong className="text-white">{employees}</strong> employees at <strong className="text-white">${hourlyWage}/hr</strong> with <strong className="text-white">{downtimeHours} hours</strong> downtime per incident. Industry multiplier: <strong className="text-white">{industryMultipliers[industry]?.multiplier}×</strong>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'service' && (
                  <div className="animate-in fade-in duration-300 motion-reduce:animate-none">
                    <h2 className="mb-3 font-heading text-2xl font-semibold text-[#1A1228] md:text-3xl">
                      Estimate Your Service Investment
                    </h2>
                    <p className="mb-8 max-w-[60ch] text-base leading-relaxed text-[#3A3448]">
                      Estimate from published per-user rates and monthly minimums. Final pricing is confirmed after assessment.
                    </p>

                    <div className="mb-6">
                      <Label id="calc-package-label" className={labelClass}>Service Package</Label>
                      <Select value={servicePackage} onValueChange={(value) => setServicePackage(value as PricingTierKey)}>
                        <SelectTrigger aria-labelledby="calc-package-label" className={fieldClass} data-testid="select-service-package">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className={selectContentClass}>
                          {Object.entries(servicePackages).map(([key, { name }]) => (
                            <SelectItem key={key} value={key} className={selectItemClass} data-testid={`option-package-${key}`}>
                              {name} (${pricing[key as PricingTierKey].user}/user/month · {pricing[key as PricingTierKey].monthlyMin.toLocaleString()}/mo minimum)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="mb-6">
                      <Label htmlFor="calc-service-employees" className={labelClass}>Number of Employees</Label>
                      <Input id="calc-service-employees" type="number" inputMode="decimal" value={serviceEmployees} onChange={(e) => setServiceEmployees(e.target.value)} className={fieldClass} placeholder="10" data-testid="input-service-employees" />
                    </div>

                    <p className="mb-6 max-w-[60ch] text-sm leading-relaxed text-[#4A445A]">
                      Backup, network, and compliance add-ons are scoped after assessment — not published as a per-user add-on rate here.
                    </p>

                    <Button
                      onClick={calculateService}
                      className="h-14 w-full bg-[#D3126A] text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#b80f5c]"
                      data-testid="button-calculate-service"
                    >
                      Calculate Cost <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
                    </Button>

                    <div aria-live="polite">
                      {showServiceResults && (
                        <div className={`mt-8 ${resultPanel} animate-in slide-in-from-bottom-4 duration-500 motion-reduce:animate-none`}>
                          <div className="absolute inset-x-0 top-0 h-0.5 bg-[#D3126A]" aria-hidden="true" />
                          <div className="space-y-6">
                            <div>
                              <p className={resultLabel}>Monthly Investment</p>
                              <p className={`${resultNum} text-4xl md:text-5xl`} data-testid="result-monthly">
                                ${money(serviceResult.monthly)}
                              </p>
                            </div>
                            <div className="grid gap-6 border-t border-white/10 pt-6 md:grid-cols-2">
                              <div>
                                <p className={resultLabel}>Quarterly (3 × monthly)</p>
                                <p className="font-mono text-2xl font-bold text-emerald-300" data-testid="result-quarterly">
                                  ${money(serviceResult.quarterly)}
                                </p>
                              </div>
                              <div>
                                <p className={resultLabel}>Annual (12 × monthly)</p>
                                <p className="font-mono text-2xl font-bold text-emerald-300" data-testid="result-annual-service">
                                  ${money(serviceResult.annual)}
                                </p>
                              </div>
                            </div>
                          </div>
                          <p className="mt-6 text-sm leading-relaxed text-white/70">
                            <strong className="text-white">{servicePackages[servicePackage]?.name}</strong> for <strong className="text-white">{serviceEmployees}</strong> users, including the published monthly minimum.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Container>
      </Chapter>

      <ClosingCta
        tone="surface"
        title="Ready to confirm the real number?"
        lede="This calculator is an estimate. A Cyber Risk Assessment confirms users, sites, backup, and the monthly floor that actually applies."
        primary={{ label: CTA.primary, href: "/book", testId: "button-conversion-assessment" }}
      />
    </PageTemplate>
  );
}
