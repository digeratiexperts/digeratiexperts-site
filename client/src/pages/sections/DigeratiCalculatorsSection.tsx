import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PremiumSlider } from "@/components/ui/premium-slider";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronDown, DollarSign, TrendingDown, Building2, Calculator } from "lucide-react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { pricing } from "@/data/pricing";

interface CalculatorProps {
  employees: number;
  setEmployees: (value: number) => void;
  hourlyWage: number;
  setHourlyWage: (value: number) => void;
  downtime: number;
  setDowntime: (value: number) => void;
  industry: string;
  setIndustry: (value: string) => void;
  downtimeCost: number;
  serviceEmployees: number;
  setServiceEmployees: (value: number) => void;
  servicePackage: string;
  setServicePackage: (value: string) => void;
  serviceCost: number;
}

export const DigeratiCalculatorsSection = (props: CalculatorProps): JSX.Element => {
  const prefersReducedMotion = useReducedMotion();
  const {
    employees, setEmployees,
    hourlyWage, setHourlyWage,
    downtime, setDowntime,
    industry, setIndustry,
    downtimeCost,
    serviceEmployees, setServiceEmployees,
    servicePackage, setServicePackage,
    serviceCost
  } = props;

  const [downtimeExpanded, setDowntimeExpanded] = useState(true);
  const [pricingExpanded, setPricingExpanded] = useState(false);

  return (
    <section id="calculators" className="relative overflow-hidden py-6 md:py-8">
      <div className="relative z-10 mx-auto max-w-4xl px-0">
        {/* Section header */}
        <motion.div 
          className="text-center mb-8 md:mb-10"
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.35 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-[#D3126A]/15 border border-[#D3126A]/30 mb-4 md:mb-6">
            <Calculator className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#F04C97]" />
            <span className="text-sm md:text-base font-medium text-[#F04C97]">Assessment</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl font-bold text-white mb-3 md:mb-4 px-2">
            Calculate Your <span className="text-de-magenta-ink">Investment</span>
          </h2>
          <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto px-4">
            Start with the numbers — downtime risk and monthly protection — then schedule a full cyber risk assessment.
          </p>
        </motion.div>

        {/* Calculator accordions */}
        <div className="space-y-4">
          {/* Downtime Calculator Accordion */}
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-30px" }}
            transition={{ duration: 0.3 }}
          >
            <Card className="overflow-hidden rounded-xl border border-de-hairline bg-de-raised">
              {/* Accordion trigger */}
              <button
                onClick={() => setDowntimeExpanded(!downtimeExpanded)}
                className="w-full p-5 md:p-6 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                data-testid="calculator-downtime-trigger"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl border border-de-hairline bg-de-bg flex items-center justify-center">
                    <TrendingDown className="w-5 h-5 md:w-6 md:h-6 text-de-accent-ink" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg md:text-xl font-bold text-white">Downtime Cost Calculator</h3>
                    <p className="text-base text-white/50">See what IT outages really cost your business</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {!downtimeExpanded && (
                    <span className="hidden sm:block text-sm text-de-accent-ink font-medium">
                      Current estimate: ${downtimeCost.toLocaleString()}/incident
                    </span>
                  )}
                  <ChevronDown 
                    className={`w-5 h-5 text-white/50 transition-transform duration-300 ${downtimeExpanded ? 'rotate-180' : ''}`} 
                  />
                </div>
              </button>

              {/* Accordion content */}
              <AnimatePresence>
                {downtimeExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <CardContent className="p-0 border-t border-white/[0.06]">
                      {/* Calculator inputs area */}
                      <div className="p-6 md:p-8">
                        <div className="grid md:grid-cols-2 gap-6 md:gap-8">
                          {/* Industry Select */}
                          <div className="space-y-3">
                            <Label htmlFor="industry" className="text-sm font-semibold text-white/70 uppercase tracking-wider flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-de-accent-ink" />
                              Industry
                            </Label>
                            <Select value={industry} onValueChange={setIndustry}>
                              <SelectTrigger 
                                id="industry" 
                                className="h-12 bg-white/[0.05] border-white/10 text-white text-base rounded-xl hover:bg-white/[0.08] hover:border-white/20 transition-all [&>span]:text-white" 
                                data-testid="select-industry"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-[#1a1a1a] border-white/10 rounded-xl">
                                <SelectItem value="law-firm" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white rounded-lg" data-testid="option-law-firm">Law Firm (2.0×)</SelectItem>
                                <SelectItem value="cpa-firm" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white rounded-lg" data-testid="option-cpa-firm">CPA Firm (1.8×)</SelectItem>
                                <SelectItem value="medical" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white rounded-lg" data-testid="option-medical">Medical Practice (2.5×)</SelectItem>
                                <SelectItem value="general-office" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white rounded-lg" data-testid="option-general-office">General Office (1.6×)</SelectItem>
                                <SelectItem value="real-estate" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white rounded-lg" data-testid="option-real-estate">Real Estate (1.6×)</SelectItem>
                                <SelectItem value="animal-hospital" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white rounded-lg" data-testid="option-animal-hospital">Animal Hospital (2.2×)</SelectItem>
                                <SelectItem value="retail" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white rounded-lg" data-testid="option-retail">Retail/Sales (1.7×)</SelectItem>
                                <SelectItem value="manufacturing" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white rounded-lg" data-testid="option-manufacturing">Manufacturing (2.0×)</SelectItem>
                                <SelectItem value="nonprofit" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white rounded-lg" data-testid="option-nonprofit">Nonprofit (1.5×)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Employees Slider */}
                          <div className="space-y-3">
                            <Label htmlFor="employees-affected" className="text-sm font-semibold text-white/70 uppercase tracking-wider flex items-center justify-between">
                              <span>Employees Affected</span>
                              <span className="text-lg font-bold text-de-accent-ink">{employees}</span>
                            </Label>
                            <div className="pt-2">
                              <PremiumSlider 
                                id="employees-affected"
                                aria-label="Employees affected"
                                value={[employees]} 
                                onValueChange={(value) => setEmployees(value[0])}
                                max={100} 
                                min={1} 
                                step={1}
                                data-testid="slider-employees-affected"
                              />
                            </div>
                          </div>

                          {/* Hourly Wage Slider */}
                          <div className="space-y-3">
                            <Label htmlFor="hourly-wage" className="text-sm font-semibold text-white/70 uppercase tracking-wider flex items-center justify-between">
                              <span>Avg Hourly Wage</span>
                              <span className="text-lg font-bold text-de-accent-ink">${hourlyWage}</span>
                            </Label>
                            <div className="pt-2">
                              <PremiumSlider 
                                id="hourly-wage"
                                aria-label="Average hourly wage in dollars"
                                value={[hourlyWage]} 
                                onValueChange={(value) => setHourlyWage(value[0])}
                                max={200} 
                                min={15} 
                                step={5}
                                data-testid="slider-hourly-wage"
                              />
                            </div>
                          </div>

                          {/* Downtime Hours Slider */}
                          <div className="space-y-3">
                            <Label htmlFor="downtime-hours" className="text-sm font-semibold text-white/70 uppercase tracking-wider flex items-center justify-between">
                              <span>Expected Downtime</span>
                              <span className="text-lg font-bold text-de-accent-ink">{downtime}h</span>
                            </Label>
                            <div className="pt-2">
                              <PremiumSlider 
                                id="downtime-hours"
                                aria-label="Expected downtime in hours"
                                value={[downtime]} 
                                onValueChange={(value) => setDowntime(value[0])}
                                max={24} 
                                min={1} 
                                step={1}
                                data-testid="slider-downtime-hours"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Results area */}
                      <div className="border-t border-white/10 bg-de-bg p-6 md:p-8">
                        <div className="grid sm:grid-cols-2 gap-6">
                          <div className="text-center sm:text-left">
                            <p className="text-xs font-bold text-white/50 uppercase tracking-widest mb-2">Per-Incident Cost</p>
                            <p className="text-3xl md:text-4xl font-bold text-de-magenta-ink">
                              ${downtimeCost.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </p>
                          </div>
                          <div className="text-center sm:text-left">
                            <p className="text-xs font-bold text-white/50 uppercase tracking-widest mb-2">Annual Cost (4 incidents)</p>
                            <p className="text-3xl md:text-4xl font-bold text-white">
                              ${(downtimeCost * 4).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </p>
                          </div>
                        </div>

                        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                          <Button asChild 
                              size="lg"
                              className="h-12 px-6 bg-white text-black hover:bg-white/90 font-semibold rounded-xl shadow-lg transition-all duration-300 hover:scale-[1.02]" 
                              data-testid="button-get-protected"
                            >
                  <a href="/book">
                    Get Protected Now
                              <ChevronRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                        </div>
                      </div>
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>

          {/* Pricing Estimator Accordion */}
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-30px" }}
            transition={{ duration: 0.3, delay: 0.05 }}
          >
            <Card className="overflow-hidden rounded-xl border border-de-hairline bg-de-raised">
              {/* Accordion trigger */}
              <button
                onClick={() => setPricingExpanded(!pricingExpanded)}
                className="w-full p-5 md:p-6 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                data-testid="calculator-pricing-trigger"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl border border-de-hairline bg-de-bg flex items-center justify-center">
                    <DollarSign className="w-5 h-5 md:w-6 md:h-6 text-de-accent-ink" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg md:text-xl font-bold text-white">Monthly Investment Estimator</h3>
                    <p className="text-base text-white/50">Transparent pricing based on your team size</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {!pricingExpanded && (
                    <motion.span 
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="hidden sm:block text-sm text-de-accent-ink font-medium"
                    >
                      Current estimate: ${serviceCost.toLocaleString()}/mo
                    </motion.span>
                  )}
                  <ChevronDown 
                    className={`w-5 h-5 text-white/50 transition-transform duration-300 ${pricingExpanded ? 'rotate-180' : ''}`} 
                  />
                </div>
              </button>

              {/* Accordion content */}
              <AnimatePresence>
                {pricingExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <CardContent className="p-0 border-t border-white/[0.06]">
                      <div className="p-6 md:p-8">
                        <div className="grid md:grid-cols-2 gap-6 md:gap-8">
                          {/* Service Employees Slider */}
                          <div className="space-y-3">
                            <Label htmlFor="service-employees" className="text-sm font-semibold text-white/70 uppercase tracking-wider flex items-center justify-between">
                              <span>Number of Employees</span>
                              <span className="text-lg font-bold text-de-accent-ink">{serviceEmployees}</span>
                            </Label>
                            <div className="pt-2">
                              <PremiumSlider 
                                id="service-employees"
                                aria-label="Number of employees"
                                value={[serviceEmployees]} 
                                onValueChange={(value) => setServiceEmployees(value[0])}
                                max={100} 
                                min={1} 
                                step={1}
                                data-testid="slider-service-employees"
                              />
                            </div>
                          </div>

                          {/* Service Package Select */}
                          <div className="space-y-3">
                            <Label htmlFor="service-package" className="text-sm font-semibold text-white/70 uppercase tracking-wider">
                              Service Package
                            </Label>
                            <Select value={servicePackage} onValueChange={setServicePackage}>
                              <SelectTrigger 
                                id="service-package" 
                                className="h-12 bg-white/[0.05] border-white/10 text-white text-base rounded-xl hover:bg-white/[0.08] hover:border-white/20 transition-all [&>span]:text-white" 
                                data-testid="select-service-package"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-[#1a1a1a] border-white/10 rounded-xl">
                                <SelectItem value={String(pricing.it.user)} className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white rounded-lg" data-testid="option-it">IT - ${pricing.it.user}/user/mo</SelectItem>
                                <SelectItem value={String(pricing.office.user)} className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white rounded-lg" data-testid="option-office">Office - ${pricing.office.user}/user/mo</SelectItem>
                                <SelectItem value={String(pricing.business.user)} className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white rounded-lg" data-testid="option-business">Business - ${pricing.business.user}/user/mo</SelectItem>
                                <SelectItem value={String(pricing.enterprise.user)} className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white rounded-lg" data-testid="option-enterprise">Enterprise - ${pricing.enterprise.user}/user/mo</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      {/* Results area */}
                      <div className="border-t border-white/10 bg-de-bg p-6 md:p-8">
                        <div className="text-center">
                          <p className="text-xs font-bold text-white/50 uppercase tracking-widest mb-2">Estimated Monthly Cost</p>
                          <p className="text-4xl md:text-5xl font-bold text-de-magenta-ink">
                            ${serviceCost.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </p>
                          <p className="text-base text-white/50 mt-2">
                            ${servicePackage}/user/month
                          </p>
                          <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-de-hairline bg-de-bg">
                            <span className="text-sm font-semibold text-de-accent-ink">
                              Quarterly: ${(serviceCost * 3 * 0.9).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} (save 10%)
                            </span>
                          </div>
                        </div>

                        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                          <Button asChild 
                              size="lg"
                              className="h-12 px-6 bg-de-magenta text-white hover:bg-[#e01874] font-semibold rounded-xl transition-colors" 
                              data-testid="button-schedule-consultation"
                            >
                  <a href="/book">
                    Schedule Consultation
                              <ChevronRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                        </div>
                      </div>
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
