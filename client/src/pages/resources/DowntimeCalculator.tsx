import { estimateMonthly, pricing, type PricingTierKey } from "@/data/pricing";
import { ConversionPathBar } from "@/components/ConversionPathBar";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowRight, Plus, Minus, Calculator, DollarSign, Clock, TrendingUp, Shield } from "lucide-react";
import { MegaMenu } from "@/components/MegaMenu";
import { DigeratiEnhancedFooterSection } from "@/pages/sections/DigeratiEnhancedFooterSection";
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
    switch (level) {
      case 'critical':
        return <span className="inline-block px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wide bg-red-500/15 border-2 border-red-500/40 text-white">Critical Risk - Immediate Action Required</span>;
      case 'high':
        return <span className="inline-block px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wide bg-[#D3126A]/15 border-2 border-[#D3126A]/40 text-white">High Risk - Protection Recommended</span>;
      case 'moderate':
        return <span className="inline-block px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wide bg-[#D3126A]/15 border-2 border-[#D3126A]/40 text-white">Moderate Risk - Consider Protection</span>;
      default:
        return <span className="inline-block px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wide bg-emerald-500/15 border-2 border-emerald-500/40 text-white">Low Risk - Maintain Vigilance</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#050312]">
      <MegaMenu />

      <main id="page-main">
      {/* Hero Section */}
      <section className="de-nav-clear pb-16 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#D3126A]/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#D3126A]/5 rounded-full blur-[120px]" />
        </div>
        
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#D3126A]/10 border border-[#D3126A]/30 mb-6">
              <Calculator className="w-4 h-4 text-[#D3126A]" />
              <span className="text-sm text-de-magenta-ink font-medium">Business Impact Calculator</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              IT Cost <span className="text-[#D3126A]">Calculators</span>
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Understand the true cost of IT downtime and get accurate service estimates for your business.
            </p>
          </div>

          {/* Calculator Container */}
          <div className="bg-[#050312] rounded-xl border-2 border-[#D3126A]/15 shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b-2 border-[#D3126A]/15">
              <button
                type="button"
                aria-pressed={activeTab === 'downtime'}
                onClick={() => setActiveTab('downtime')}
                className={`flex-1 px-6 py-5 text-sm font-bold uppercase tracking-wider transition-all duration-300 border-b-3 ${
                  activeTab === 'downtime'
                    ? 'text-de-magenta-ink bg-[#D3126A]/10 border-b-[#D3126A] shadow-[0_0_10px_rgba(211,18,106,0.3)]'
                    : 'text-gray-400 hover:text-white hover:bg-[#D3126A]/5 border-b-transparent'
                }`}
                data-testid="tab-downtime-cost"
              >
                <Clock className="w-4 h-4 inline-block mr-2 -mt-0.5" />
                Downtime Cost
              </button>
              <button
                type="button"
                aria-pressed={activeTab === 'service'}
                onClick={() => setActiveTab('service')}
                className={`flex-1 px-6 py-5 text-sm font-bold uppercase tracking-wider transition-all duration-300 border-b-3 ${
                  activeTab === 'service'
                    ? 'text-de-magenta-ink bg-[#D3126A]/10 border-b-[#D3126A] shadow-[0_0_10px_rgba(211,18,106,0.3)]'
                    : 'text-gray-400 hover:text-white hover:bg-[#D3126A]/5 border-b-transparent'
                }`}
                data-testid="tab-service-cost"
              >
                <DollarSign className="w-4 h-4 inline-block mr-2 -mt-0.5" />
                Service Cost
              </button>
            </div>

            {/* Calculator Content */}
            <div className="p-8 md:p-12">
              {/* Downtime Calculator */}
              {activeTab === 'downtime' && (
                <div className="animate-in fade-in duration-300">
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
                    What's Downtime Really Costing You?
                  </h2>
                  <p className="text-gray-400 mb-8">
                    Calculate the true cost of IT downtime for your business with industry-specific multipliers and RTO/RPO factors.
                  </p>

                  {/* Industry Select */}
                  <div className="mb-6">
                    <Label id="calc-industry-label" className="text-xs font-semibold uppercase tracking-wide text-white mb-2 block">Industry</Label>
                    <Select value={industry} onValueChange={setIndustry}>
                      <SelectTrigger aria-labelledby="calc-industry-label" className="h-14 bg-[#151217] border-2 border-[#D3126A]/15 text-white hover:border-[#D3126A] focus:border-[#D3126A] focus:ring-2 focus:ring-[#D3126A]/30 transition-all" data-testid="select-calc-industry">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#151217] border-[#D3126A]/30">
                        {Object.entries(industryMultipliers).map(([key, { name, multiplier }]) => (
                          <SelectItem 
                            key={key} 
                            value={key} 
                            className="text-white hover:bg-[#D3126A]/20 focus:bg-[#D3126A]/20 focus:text-white"
                            data-testid={`option-calc-${key}`}
                          >
                            {name} ({multiplier}×)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Two Column Inputs */}
                  <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <Label className="text-xs font-semibold uppercase tracking-wide text-white mb-2 block">Employees Affected</Label>
                      <Input
                        type="number"
                        value={employees}
                        onChange={(e) => setEmployees(e.target.value)}
                        className="h-14 bg-[#151217] border-2 border-[#D3126A]/15 text-white placeholder:text-white/70 hover:border-[#D3126A] focus:border-[#D3126A] focus:ring-2 focus:ring-[#D3126A]/30 transition-all"
                        placeholder="25"
                        data-testid="input-employees"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold uppercase tracking-wide text-white mb-2 block">Avg Hourly Wage ($)</Label>
                      <Input
                        type="number"
                        value={hourlyWage}
                        onChange={(e) => setHourlyWage(e.target.value)}
                        className="h-14 bg-[#151217] border-2 border-[#D3126A]/15 text-white placeholder:text-white/70 hover:border-[#D3126A] focus:border-[#D3126A] focus:ring-2 focus:ring-[#D3126A]/30 transition-all"
                        placeholder="35"
                        data-testid="input-hourly-wage"
                      />
                    </div>
                  </div>

                  {/* Downtime Hours */}
                  <div className="mb-6">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-white mb-2 block">Expected Downtime (Hours)</Label>
                    <Input
                      type="number"
                      value={downtimeHours}
                      onChange={(e) => setDowntimeHours(e.target.value)}
                      className="h-14 bg-[#151217] border-2 border-[#D3126A]/15 text-white placeholder:text-white/70 hover:border-[#D3126A] focus:border-[#D3126A] focus:ring-2 focus:ring-[#D3126A]/30 transition-all"
                      placeholder="4"
                      data-testid="input-downtime-hours"
                    />
                  </div>

                  {/* Advanced Options */}
                  <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                    <CollapsibleTrigger className="w-full flex items-center justify-between px-5 py-4 bg-[#151217] border-2 border-[#D3126A]/15 rounded-lg text-xs font-semibold uppercase tracking-wide text-white hover:border-[#D3126A] hover:bg-[#D3126A]/5 transition-all mb-6" data-testid="toggle-advanced-options">
                      <span>Advanced Options (RTO/RPO & Annual Impact)</span>
                      {advancedOpen ? <Minus className="w-5 h-5 text-[#D3126A]" /> : <Plus className="w-5 h-5 text-[#D3126A]" />}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mb-6">
                      <div className="p-6 bg-[#151217] border-2 border-[#D3126A]/15 rounded-lg space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs font-semibold uppercase tracking-wide text-white mb-2 block">RTO - Recovery Time Objective (Hours)</Label>
                            <Input
                              type="number"
                              value={rtoHours}
                              onChange={(e) => setRtoHours(e.target.value)}
                              className="h-12 bg-[#050312] border-2 border-[#D3126A]/15 text-white placeholder:text-white/70 hover:border-[#D3126A] focus:border-[#D3126A] transition-all"
                              placeholder="4"
                              data-testid="input-rto"
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-semibold uppercase tracking-wide text-white mb-2 block">RPO - Recovery Point Objective (Hours)</Label>
                            <Input
                              type="number"
                              value={rpoHours}
                              onChange={(e) => setRpoHours(e.target.value)}
                              className="h-12 bg-[#050312] border-2 border-[#D3126A]/15 text-white placeholder:text-white/70 hover:border-[#D3126A] focus:border-[#D3126A] transition-all"
                              placeholder="1"
                              data-testid="input-rpo"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs font-semibold uppercase tracking-wide text-white mb-2 block">Expected Incidents Per Year</Label>
                          <Input
                            type="number"
                            value={incidentsPerYear}
                            onChange={(e) => setIncidentsPerYear(e.target.value)}
                            className="h-12 bg-[#050312] border-2 border-[#D3126A]/15 text-white placeholder:text-white/70 hover:border-[#D3126A] focus:border-[#D3126A] transition-all"
                            placeholder="4"
                            data-testid="input-incidents"
                          />
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Calculate Button */}
                  <Button
                    onClick={calculateDowntime}
                    className="h-14 w-full bg-[#D3126A] text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#b80f5c]"
                    data-testid="button-calculate-downtime"
                  >
                    Calculate Cost <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>

                  {/* Results */}
                  {showDowntimeResults && (
                    <div className="mt-8 p-8 bg-[#151217] rounded-xl border-2 border-[#D3126A]/15 relative overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#D3126A] to-transparent" />
                      
                      <div className="grid md:grid-cols-2 gap-8 mb-6">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Per-Incident Cost</p>
                          <p className="text-4xl font-extrabold text-[#D3126A] drop-shadow-[0_0_20px_rgba(211,18,106),0.3)]" data-testid="result-per-incident">
                            ${downtimeResult.perIncident.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Annual Downtime Cost</p>
                          <p className="text-5xl font-extrabold text-[#D3126A] drop-shadow-[0_0_20px_rgba(211,18,106),0.3)]" data-testid="result-annual">
                            ${downtimeResult.annual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>

                      <div className="mb-4">
                        {getRiskBadge(downtimeResult.riskLevel)}
                      </div>

                      <p className="text-sm text-gray-400 italic">
                        Based on <strong className="text-[#D3126A]">{employees}</strong> employees at <strong className="text-[#D3126A]">${hourlyWage}/hr</strong> with <strong className="text-[#D3126A]">{downtimeHours} hours</strong> downtime per incident. Industry multiplier: <strong className="text-[#D3126A]">{industryMultipliers[industry]?.multiplier}×</strong>
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Service Cost Calculator */}
              {activeTab === 'service' && (
                <div className="animate-in fade-in duration-300">
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
                    Estimate Your Service Investment
                  </h2>
                  <p className="text-gray-400 mb-8">
                    Estimate from published per-user rates and monthly minimums. Final pricing is confirmed after assessment.
                  </p>

                  {/* Service Package */}
                  <div className="mb-6">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-white mb-2 block">Service Package</Label>
                    <Select value={servicePackage} onValueChange={(value) => setServicePackage(value as PricingTierKey)}>
                      <SelectTrigger className="h-14 bg-[#151217] border-2 border-[#D3126A]/15 text-white hover:border-[#D3126A] focus:border-[#D3126A] focus:ring-2 focus:ring-[#D3126A]/30 transition-all" data-testid="select-service-package">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#151217] border-[#D3126A]/30">
                        {Object.entries(servicePackages).map(([key, { name }]) => (
                          <SelectItem 
                            key={key} 
                            value={key} 
                            className="text-white hover:bg-[#D3126A]/20 focus:bg-[#D3126A]/20 focus:text-white"
                            data-testid={`option-package-${key}`}
                          >
                            {name} (${pricing[key as PricingTierKey].user}/user/month · {pricing[key as PricingTierKey].monthlyMin.toLocaleString()}/mo minimum)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Employees */}
                  <div className="mb-6">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-white mb-2 block">Number of Employees</Label>
                    <Input
                      type="number"
                      value={serviceEmployees}
                      onChange={(e) => setServiceEmployees(e.target.value)}
                      className="h-14 bg-[#151217] border-2 border-[#D3126A]/15 text-white placeholder:text-white/70 hover:border-[#D3126A] focus:border-[#D3126A] focus:ring-2 focus:ring-[#D3126A]/30 transition-all"
                      placeholder="10"
                      data-testid="input-service-employees"
                    />
                  </div>

                  <p className="mb-6 text-sm text-white/55">
                    Backup, network, and compliance add-ons are scoped after assessment — not published as a per-user add-on rate here.
                  </p>

                  {/* Calculate Button */}
                  <Button
                    onClick={calculateService}
                    className="h-14 w-full bg-[#D3126A] text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#b80f5c]"
                    data-testid="button-calculate-service"
                  >
                    Calculate Cost <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>

                  {/* Results */}
                  {showServiceResults && (
                    <div className="mt-8 p-8 bg-[#151217] rounded-xl border-2 border-[#D3126A]/15 relative overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#D3126A] to-transparent" />
                      
                      <div className="space-y-6">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Monthly Investment</p>
                          <p className="text-5xl font-extrabold text-[#D3126A] drop-shadow-[0_0_20px_rgba(211,18,106),0.3)]" data-testid="result-monthly">
                            ${serviceResult.monthly.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-6 pt-6 border-t border-[#D3126A]/15">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Quarterly (3 × monthly)</p>
                            <p className="text-2xl font-bold text-emerald-400" data-testid="result-quarterly">
                              ${serviceResult.quarterly.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Annual (12 × monthly)</p>
                            <p className="text-2xl font-bold text-emerald-400" data-testid="result-annual-service">
                              ${serviceResult.annual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                      </div>

                      <p className="text-sm text-gray-400 italic mt-6">
                        <strong className="text-[#D3126A]">{servicePackages[servicePackage]?.name}</strong> for <strong className="text-[#D3126A]">{serviceEmployees}</strong> users, including the published monthly minimum.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-12">
            <ConversionPathBar
              headline="Ready to confirm the real number?"
              body="This calculator is an estimate. A Cyber Risk Assessment confirms users, sites, backup, and the monthly floor that actually applies."
            />
          </div>
        </div>
      </section>
      </main>

      <DigeratiEnhancedFooterSection />
    </div>
  );
}
