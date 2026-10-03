import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { pricing, formatPrice, estimateMonthly } from "@/data/pricing";

interface PricingPlan {
  name: string;
  tier: string;
  monthlyPrice: number;
  perUserPrice: number;
  note: string;
  features: string[];
  learnMoreUrl: string;
}

const defaultPlans: PricingPlan[] = [
  {
    name: pricing.it.name,
    tier: pricing.it.tier,
    monthlyPrice: estimateMonthly("it", 1),
    perUserPrice: pricing.it.user,
    note: pricing.it.idealBuyer,
    learnMoreUrl: pricing.it.learnMoreUrl,
    features: [...pricing.it.inclusions],
  },
  {
    name: pricing.office.name,
    tier: pricing.office.tier,
    monthlyPrice: estimateMonthly("office", 1),
    perUserPrice: pricing.office.user,
    note: pricing.office.idealBuyer,
    learnMoreUrl: pricing.office.learnMoreUrl,
    features: [...pricing.office.inclusions],
  },
  {
    name: pricing.business.name,
    tier: pricing.business.tier,
    monthlyPrice: estimateMonthly("business", 1),
    perUserPrice: pricing.business.user,
    note: pricing.business.idealBuyer,
    learnMoreUrl: pricing.business.learnMoreUrl,
    features: [...pricing.business.inclusions],
  },
  {
    name: pricing.enterprise.name,
    tier: pricing.enterprise.tier,
    monthlyPrice: estimateMonthly("enterprise", 1),
    perUserPrice: pricing.enterprise.user,
    note: pricing.enterprise.idealBuyer,
    learnMoreUrl: pricing.enterprise.learnMoreUrl,
    features: [...pricing.enterprise.inclusions],
  },
];

interface ServiceMatrixProps {
  variant?: "full" | "compact";
  plans?: PricingPlan[];
  showCTA?: boolean;
  className?: string;
  highlightTier?: "it" | "office" | "business" | "enterprise";
  showOnlyHighlighted?: boolean;
}

export function ServiceMatrix({ 
  variant = "full", 
  plans = defaultPlans,
  showCTA = true,
  className = "",
  highlightTier,
  showOnlyHighlighted = false
}: ServiceMatrixProps) {
  const prefersReducedMotion = useReducedMotion();
  
  const filteredPlans = showOnlyHighlighted && highlightTier 
    ? plans.filter(p => p.name.toLowerCase() === highlightTier)
    : plans;

  const containerVariants = prefersReducedMotion ? undefined : {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const cardVariants = prefersReducedMotion ? undefined : {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  if (variant === "compact") {
    return (
      <div className={`rounded-2xl border border-white/10 p-6 bg-white/[0.02] ${className}`} data-testid="service-matrix-compact">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold text-white mb-1">Protection Plans</h3>
            <p className="text-white/60 text-sm">Starting at ${pricing.office.user}/user/month</p>
          </div>
          <Button
            asChild
            className="bg-de-accent hover:bg-de-accent text-white"
            data-testid="button-view-pricing"
          >
            <Link href="/pricing">
              View Full Pricing
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>
        
        <div className={`grid gap-4 ${filteredPlans.length === 1 ? 'grid-cols-1 max-w-md mx-auto' : 'grid-cols-2 xl:grid-cols-4'}`}>
          {filteredPlans.map((plan) => {
            const isHighlighted = highlightTier && plan.name.toLowerCase() === highlightTier;
            return (
              <div 
                key={plan.name}
                className="rounded-xl p-4 text-center border border-white/10 bg-white/[0.02]"
                data-testid={`plan-compact-${plan.name.toLowerCase()}`}
              >
                {isHighlighted && (
                  <div className="text-xs text-white/50 font-medium mb-2">Typically included here</div>
                )}
                <div className="text-white font-bold text-lg">{plan.name}</div>
                <div className="text-white/50 text-sm">{plan.tier}</div>
                <div className="text-white font-bold text-2xl mt-2">${plan.perUserPrice}</div>
                <div className="text-white/50 text-xs">/user/mo</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      className={`grid grid-cols-1 gap-6 ${filteredPlans.length === 1 ? 'max-w-lg mx-auto' : 'sm:grid-cols-2 xl:grid-cols-4'} ${className}`}
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      data-testid="service-matrix-full"
    >
      {filteredPlans.map((plan) => {
        const isHighlighted = highlightTier && plan.name.toLowerCase() === highlightTier;
        return (
          <motion.div
            key={plan.name}
            className="relative overflow-hidden rounded-2xl border border-de-hairline bg-de-raised p-6 group hover:-translate-y-1 transition-all duration-300"
            variants={cardVariants}
            data-testid={`plan-${plan.name.toLowerCase()}`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-de-bg text-white border border-de-hairline">
                {plan.name}
              </span>
              {isHighlighted && (
                <span className="text-xs text-white/50 font-medium">Typically here</span>
              )}
            </div>
            
            <div className="text-white/60 text-xs uppercase tracking-wide mb-1">{plan.tier}</div>
            
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-white/50 text-sm mr-1">From</span>
              <span className="text-white font-black text-4xl">{formatPrice(plan.monthlyPrice)}</span>
              <span className="text-white/50">/mo</span>
            </div>
            
            <div className="text-white/50 text-sm mb-4">
              ${plan.perUserPrice}/user/mo · monthly minimum
            </div>
            
            <p className="text-white/70 text-sm mb-6">{plan.note}</p>
            
            <ul className="space-y-3 mb-6">
              {plan.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-de-accent-ink flex-shrink-0 mt-0.5" />
                  <span className="text-white/80">{feature}</span>
                </li>
              ))}
            </ul>
            
            {showCTA && (
              <Button
                asChild
                className="w-full border-de-hairline bg-de-bg text-white hover:bg-de-raised hover:text-white"
                variant="outline"
                data-testid={`button-learn-more-${plan.name.toLowerCase()}`}
              >
                <Link href={plan.learnMoreUrl}>
                  See {plan.name} details
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            )}
          </motion.div>
        );
      })}
    </motion.div>
  );
}
